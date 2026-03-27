import express from "express";
import Seller from "../models/Seller.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const seller = await Seller.create(req.body);
  res.json(seller);
});

router.get("/:id", async (req, res) => {
  const seller = await Seller.findById(req.params.id);
  res.json(seller);
});

export default router;