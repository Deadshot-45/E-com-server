import express from "express";
import { Product } from "../models/Product.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const product = await Product.create(req.body);
  res.json(product);
});

router.get("/", async (req, res) => {
  const products = await Product.find(req.query);
  res.json(products);
});

export default router;
