import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Order } from "../models/Order.js";

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
