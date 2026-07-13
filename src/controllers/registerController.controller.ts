import express from "express";
import User from "../models/User.js";
import Customer from "../models/Customer.js";
import { hashPassword, validatePassword } from "../utils/passwordUtils.js";

const userRegister = async (req: express.Request, res: express.Response) => {
  const { email, password, fullName, gender, phoneNumber } = req.body;

  // Validate password length and pattern
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.isValid) {
    return res
      .status(400)
      .json({ success: false, message: passwordCheck.message });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();

    // Check for existing email in User
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    // Check for existing phone number in Customer
    if (phoneNumber) {
      const existingCustomer = await Customer.findOne({ phoneNumber: phoneNumber.trim() });
      if (existingCustomer) {
        return res.status(409).json({
          success: false,
          message: "An account with this mobile number already exists.",
        });
      }
    }

    // Hash the password before saving
    const hashedPassword = await hashPassword(password);

    // Create authentication User
    const newUser = await User.create({
      email: normalizedEmail,
      passwordHash: hashedPassword,
      role: "customer",
      isActive: true,
    });

    // Create shopper Customer profile
    const newCustomer = await Customer.create({
      userId: newUser._id,
      fullName: fullName.trim(),
      gender,
      phoneNumber: phoneNumber ? phoneNumber.trim() : undefined,
    });

    res.status(201).json({
      message: "User registered successfully",
      success: true,
      data: {
        user: {
          id: newUser._id,
          email: newUser.email,
          role: newUser.role,
        },
        customer: newCustomer,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred during registration.",
    });
  }
};

export { userRegister };
