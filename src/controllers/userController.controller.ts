import { Request, Response } from "express";
import User from "../models/User.js";
import { hashPassword } from "../utils/passwordUtils.js";


export const createUser = async (req: Request, res: Response) => {
  const { email, password, name, role = "customer", isActive = true } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({
      success: false,
      message: "Email, password, and name are required.",
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
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
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create user.",
    });
  }
};

export const getUserDetails = async (req: Request, res: Response) => {
    try {
        const userId = req.params.id || (req as any).user?._id;
        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({ success: true, data: user });
    } catch (error) {
        res.status(404).json({ success: false, message: "User not found" });
    }
};