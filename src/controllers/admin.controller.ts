import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import User from "../models/User.js";
import Seller from "../models/Seller.js";
import { comparePassword, hashPassword, validatePassword } from "../utils/passwordUtils.js";
import { loginUser } from "../utils/sessionHelpers.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

/**
 * POST /api/admin/login
 * Admin Login API
 */
export const adminLogin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email?.trim() || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required.",
      code: "MISSING_FIELDS",
    });
  }

  // Validate password strength
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.isValid) {
    return res.status(400).json({
      success: false,
      message: passwordCheck.message,
      details: passwordCheck.details,
    });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Invalid credentials.",
      code: "INVALID_CREDENTIALS",
    });
  }

  // Verify Role is Admin
  if (user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Only administrators are allowed to login here.",
      code: "FORBIDDEN",
    });
  }

  // Verify password
  const isPasswordValid = await comparePassword(password, user.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      message: "Invalid credentials.",
      code: "INVALID_CREDENTIALS",
    });
  }

  // Verify isActive
  if (!user.isActive) {
    return res.status(403).json({
      success: false,
      message: "This account has been deactivated.",
      code: "DEACTIVATED_ACCOUNT",
    });
  }

  // Generate JWT token
  const token = jwt.sign(
    {
      userId: user._id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET!,
    { expiresIn: "2h" },
  );

  const safeUserData = {
    id: user._id,
    email: user.email,
    role: user.role,
    name: user.name || "Admin User",
  };

  loginUser(
    req,
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    },
    res,
    (err) => {
      if (err) {
        console.error("Admin Session creation failed:", err);
        return res.status(500).json({
          success: false,
          message: "Login failed due to session error.",
          code: "SESSION_ERROR",
        });
      }

      res.json({
        success: true,
        message: "Logged in successfully as Admin",
        data: {
          token,
          user: safeUserData,
          sessionActive: true,
        },
      });
    },
  );
});

/**
 * GET /api/admin/dashboard/overview
 * Get admin dashboard overview (revenue, orders, etc.)
 */
export const getDashboardOverview = asyncHandler(async (req: Request, res: Response) => {
  const { range = "7d" } = req.query as { range?: string };

  const now = new Date();
  let startDate = new Date();

  switch (range) {
    case "7d":
      startDate.setDate(now.getDate() - 7);
      break;
    case "30d":
      startDate.setDate(now.getDate() - 30);
      break;
    case "90d":
      startDate.setDate(now.getDate() - 90);
      break;
    default:
      startDate.setDate(now.getDate() - 7);
  }

  const matchStage = {
    $match: {
      createdAt: { $gte: startDate },
      paymentStatus: "paid",
    },
  };

  const statsPromise = Order.aggregate([
    matchStage,
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$totalAmount" },
        totalOrders: { $sum: 1 },
        avgOrderValue: { $avg: "$totalAmount" },
      },
    },
  ]);

  const salesGraphPromise = Order.aggregate([
    matchStage,
    {
      $group: {
        _id: {
          day: { $dayOfMonth: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        revenue: { $sum: "$totalAmount" },
        orders: { $sum: 1 },
      },
    },
    {
      $sort: { "_id.month": 1, "_id.day": 1 },
    },
  ]);

  const topProductsPromise = Order.aggregate([
    matchStage,
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.productId",
        totalSold: { $sum: "$items.quantity" },
        revenue: {
          $sum: {
            $multiply: ["$items.quantity", "$items.priceSnapshot"],
          },
        },
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
  ]);

  const activeProductsPromise = Product.countDocuments({ isActive: true });
  const activeSellersPromise = Seller.countDocuments({ status: "approved" });
  const customersPromise = User.countDocuments({ role: "customer" });

  const [stats, salesGraph, topProducts, activeProducts, activeSellers, customersCount] = await Promise.all([
    statsPromise,
    salesGraphPromise,
    topProductsPromise,
    activeProductsPromise,
    activeSellersPromise,
    customersPromise,
  ]);

  const summaryStats = stats[0] || {
    totalRevenue: 0,
    totalOrders: 0,
    avgOrderValue: 0,
  };

  res.json({
    success: true,
    data: {
      summary: {
        totalRevenue: summaryStats.totalRevenue || 0,
        totalOrders: summaryStats.totalOrders || 0,
        avgOrderValue: Math.round(summaryStats.avgOrderValue || 0),
        activeProducts,
        activeSellers,
        customersCount,
      },
      salesGraph,
      topProducts,
    },
  });
});

/**
 * GET /api/admin/orders/all
 * Get all orders (with pagination & filters)
 */
export const getAllOrders = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;

  const filter: any = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);

  return res.status(200).json({
    success: true,
    message: "Orders retrieved successfully",
    data: orders,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  });
});

/**
 * POST /api/admin/users
 * Create a new user (admin/customer/seller)
 */
export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name, role = "customer", isActive = true } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({
      success: false,
      message: "Email, password, and name are required.",
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: "A user with this email already exists.",
    });
  }

  const passwordHash = await hashPassword(String(password));

  const newUser = await User.create({
    email: normalizedEmail,
    passwordHash,
    name: String(name).trim(),
    role: role === "admin" ? "admin" : role === "seller" ? "seller" : "customer",
    isActive: Boolean(isActive),
  });

  return res.status(201).json({
    success: true,
    message: "User created successfully.",
    data: {
      id: newUser._id,
      email: newUser.email,
      role: newUser.role,
      isActive: newUser.isActive,
    },
  });
});

/**
 * GET /api/admin/users/all
 * Retrieve all users with customer/seller profiles and order counts
 */
export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const pipeline = [
    {
      $lookup: {
        from: "customers",
        localField: "_id",
        foreignField: "userId",
        as: "customerProfile",
      },
    },
    {
      $lookup: {
        from: "sellers",
        localField: "_id",
        foreignField: "ownerUserId",
        as: "sellerProfile",
      },
    },
    {
      $lookup: {
        from: "orders",
        localField: "_id",
        foreignField: "userId",
        as: "userOrders",
      },
    },
    {
      $project: {
        _id: 1,
        email: 1,
        role: 1,
        isActive: 1,
        createdAt: 1,
        fullName: {
          $ifNull: [
            { $arrayElemAt: ["$customerProfile.fullName", 0] },
            {
              $ifNull: [
                { $arrayElemAt: ["$sellerProfile.name", 0] },
                "$email",
              ],
            },
          ],
        },
        ordersCount: { $size: "$userOrders" },
      },
    },
    {
      $sort: { createdAt: -1 },
    },
  ];

  const users = await User.aggregate(pipeline as any);
  res.json({ success: true, data: users });
});
