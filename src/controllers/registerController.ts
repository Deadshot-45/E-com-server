import express from "express";
import User from "../models/User.js";
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
    // Proactively check for existing email or phone number
    const existingUser = await User.findOne({
      $or: [{ email: email.trim().toLowerCase() }, { phoneNumber }],
    });

    if (existingUser) {
      if (existingUser.email === email.trim().toLowerCase()) {
        return res.status(409).json({
          success: false,
          message: "An account with this email already exists.",
        });
      }
      if (existingUser.phoneNumber === phoneNumber) {
        return res.status(409).json({
          success: false,
          message: "An account with this mobile number already exists.",
        });
      }
    }

    // Hash the password before saving
    const hashedPassword = await hashPassword(password);
    console.log("Original:", password, "Hashed:", hashedPassword);

    const newUser = await User.create({
      email: email.trim().toLowerCase(),
      passwordHash: hashedPassword,
      fullName: fullName.trim(),
      gender,
      phoneNumber,
    });

    res.status(201).json({
      message: "User registered successfully",
      success: true,
      data: { newUser },
    });
  } catch (error: any) {
    // Handle Mongoose duplicate key errors (code 11000)
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern)[0];
      const fieldName =
        duplicateField === "phoneNumber" ? "mobile number" : duplicateField;

      return res.status(409).json({
        success: false,
        message: `An account with this ${fieldName} already exists.`,
      });
    }

    // Handle standard Validation Errors or general server errors
    res.status(500).json({
      success: false,
      message:
        error.message || "An unexpected error occurred during registration.",
    });
  }
};

export { userRegister };
