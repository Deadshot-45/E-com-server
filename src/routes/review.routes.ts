import express from "express";
import Review from "../models/Review.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const review = await Review.create(req.body);
  res.json(review);
});

router.get("/product/:productId", async (req, res) => {
  const reviews = await Review.find({ productId: req.params.productId });
  res.json(reviews);
});

export default router;
