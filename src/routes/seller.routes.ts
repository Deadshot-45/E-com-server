import express from "express";
import mongoose from "mongoose";
import Seller from "../models/Seller.js";
import User from "../models/User.js";
import { hashPassword } from "../utils/passwordUtils.js";

const router = express.Router();

// GET all sellers
router.get("/", async (req, res) => {
  try {
    const sellers = await Seller.find().sort({ createdAt: -1 });
    res.json({ success: true, data: sellers });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET seller by email
router.get("/by-email/:email", async (req, res) => {
  try {
    const seller = await Seller.findOne({ contactEmail: req.params.email.toLowerCase() });
    if (!seller) {
      return res.status(404).json({ success: false, message: "Seller not found" });
    }
    res.json({ success: true, data: seller });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET seller by ID
router.get("/:id", async (req, res) => {
  try {
    const seller = await Seller.findById(req.params.id);
    if (!seller) {
      return res.status(404).json({ success: false, message: "Seller not found" });
    }
    res.json({ success: true, data: seller });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// POST onboard seller
router.post("/onboard", async (req, res) => {
  try {
    const { businessName, email, phone, ownerUserId, ...rest } = req.body;
    const normalizedEmail = email?.toLowerCase();
    
    // Check if seller already exists with this email
    const existing = await Seller.findOne({ contactEmail: normalizedEmail });
    if (existing) {
      return res.status(400).json({ success: false, message: "A seller application with this email already exists." });
    }

    // Check if corresponding User exists, create if not
    let linkedUser = await User.findOne({ email: normalizedEmail });
    if (!linkedUser) {
      const defaultHashedPassword = await hashPassword("Seller@12345"); // default credentials
      linkedUser = await User.create({
        email: normalizedEmail,
        passwordHash: defaultHashedPassword,
        name: businessName || "Seller",
        role: "seller",
        isActive: true,
      });
    }

    const data = {
      name: businessName,
      ownerUserId: linkedUser._id,
      contactEmail: normalizedEmail,
      contactPhone: phone,
      passwordHash: linkedUser.passwordHash,
      status: "pending",
      isActive: true,
      isVerified: false,
      ...rest,
    };
    
    const seller = await Seller.create(data);
    res.status(201).json({ success: true, data: seller });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH Approve seller
router.patch("/:id/approve", async (req, res) => {
  try {
    const seller = await Seller.findByIdAndUpdate(
      req.params.id,
      { status: "approved", isActive: true, isVerified: true },
      { new: true }
    );
    if (!seller) {
      return res.status(404).json({ success: false, message: "Seller not found" });
    }

    // Update corresponding user role to 'seller'
    if (seller.contactEmail) {
      await User.findOneAndUpdate(
        { email: seller.contactEmail.toLowerCase() },
        { role: "seller" }
      );
    } else if (seller.ownerUserId) {
      await User.findByIdAndUpdate(seller.ownerUserId, { role: "seller" });
    }

    res.json({ success: true, data: seller });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH Reject seller
router.patch("/:id/reject", async (req, res) => {
  try {
    const seller = await Seller.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", isActive: false },
      { new: true }
    );
    if (!seller) {
      return res.status(404).json({ success: false, message: "Seller not found" });
    }

    // Demote user role back to customer if rejected
    if (seller.contactEmail) {
      await User.findOneAndUpdate(
        { email: seller.contactEmail.toLowerCase() },
        { role: "customer" }
      );
    } else if (seller.ownerUserId) {
      await User.findByIdAndUpdate(seller.ownerUserId, { role: "customer" });
    }

    res.json({ success: true, data: seller });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
