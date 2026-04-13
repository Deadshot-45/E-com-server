import express from "express";
import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import { Product } from "../models/Product.js";
import { Order } from "../models/Order.js";

const router = express.Router();

router.post("/checkout", async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const { orders, payment } = req.body;

      await Order.insertMany(orders, { session });

      for (const order of orders) {
        for (const item of order.items) {
          await Product.updateOne(
            {
              _id: item.productId,
              "inventory.quantity": { $gte: item.quantity },
            },
            { $inc: { "inventory.quantity": -item.quantity } },
            { session },
          );
        }
      }

      await Payment.create([payment], { session });
    });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    session.endSession();
  }
});

export default router;
