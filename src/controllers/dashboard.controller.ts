import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";

/**
 * GET DASHBOARD OVERVIEW
 * - Revenue
 * - Orders
 * - AOV
 * - Top Products
 * - Sales Graph
 */
export const getDashboardOverview = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
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

    /**
     * 🔥 MATCH PAID ORDERS ONLY
     */
    const matchStage = {
      $match: {
        createdAt: { $gte: startDate },
        paymentStatus: "paid",
      },
    };

    /**
     * 💰 TOTAL REVENUE + ORDERS + AOV
     */
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

    /**
     * 📈 SALES GRAPH (DAY-WISE)
     */
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

    /**
     * 🏆 TOP PRODUCTS
     */
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

    const [stats, salesGraph, topProducts] = await Promise.all([
      statsPromise,
      salesGraphPromise,
      topProductsPromise,
    ]);

    res.json({
      success: true,
      data: {
        summary: stats[0] || {
          totalRevenue: 0,
          totalOrders: 0,
          avgOrderValue: 0,
        },
        salesGraph,
        topProducts,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getSellerDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const sellerId = req.user?._id; // auth middleware

    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const matchStage = {
      $match: {
        "items.sellerId": new mongoose.Types.ObjectId(sellerId),
        paymentStatus: "paid",
      },
    };

    const pipeline = [
      { $unwind: "$items" },
      matchStage,
      {
        $group: {
          _id: null,
          revenue: {
            $sum: {
              $multiply: ["$items.quantity", "$items.priceSnapshot"],
            },
          },
          totalOrders: { $addToSet: "$_id" },
          totalItemsSold: { $sum: "$items.quantity" },
        },
      },
      {
        $project: {
          revenue: 1,
          totalItemsSold: 1,
          totalOrders: { $size: "$totalOrders" },
        },
      },
    ];

    const result = await Order.aggregate(pipeline);

    res.json({
      success: true,
      data: result[0] || {
        revenue: 0,
        totalOrders: 0,
        totalItemsSold: 0,
      },
    });
  } catch (err) {
    next(err);
  }
};
