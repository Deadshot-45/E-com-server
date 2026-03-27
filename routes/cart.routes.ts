import express from "express";
import Cart from "../models/Cart.js";

const router = express.Router();

router.post("/add", async (req, res) => {
  const { userId, item } = req.body;

  const cart = await Cart.findOneAndUpdate(
    { userId },
    { $push: { items: item }, $set: { updatedAt: new Date() }},
    { upsert: true, new: true }
  );

  res.json(cart);
});

export default router;