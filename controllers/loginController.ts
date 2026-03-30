import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { comparePassword, validatePassword } from "../utils/passwordUtils.js";
import { loginUser } from "../utils/sessionHelpers.js";

interface LoginBody {
  identifier: string; // email OR phone
  password: string;
}

const userLogin = async (
  req: express.Request<{}, {}, LoginBody>,
  res: express.Response,
) => {
  const { identifier, password } = req.body;

  // Validate inputs
  if (!identifier?.trim() || !password) {
    return res.status(400).json({
      success: false,
      message: "Email/phone and password are required.",
      code: "MISSING_FIELDS",
    });
  }

  // Validate password strength
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.isValid) {
    return res.status(400).json({
      success: false,
      message: passwordCheck.message,
      details: passwordCheck.details,
    });
  }

  try {
    // Normalize identifiers
    const normalizedEmail = identifier.trim().toLowerCase();
    const normalizedPhone = identifier.trim();

    // Find user by email OR phone (select only needed fields)
    const user = await User.findOne(
      {
        $or: [{ email: normalizedEmail }, { phoneNumber: normalizedPhone }],
      },
      {
        passwordHash: 1,
        email: 1,
        phoneNumber: 1,
        fullName: 1,
        role: 1,
        _id: 1,
      },
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
        code: "INVALID_CREDENTIALS",
      });
    }

    const hashedPassword = user.passwordHash;

    const isPasswordValid = await comparePassword(password, hashedPassword);
    console.log(isPasswordValid);

    // Compare password (slow hash - intentional for security)
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
        code: "INVALID_CREDENTIALS",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role || "user",
      },
      process.env.JWT_SECRET!,
      { expiresIn: "2H" },
    );

    // Clean user data for response
    const { passwordHash, ...safeUserData } = user.toObject();

    // Create secure session + return both token & session
    loginUser(
      req,
      {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      res,
      (err) => {
        if (err) {
          console.error("Session creation failed:", err);
          return res.status(500).json({
            success: false,
            message: "Login failed due to session error.",
            code: "SESSION_ERROR",
          });
        }

        // Success response with BOTH session & JWT
        res.json({
          success: true,
          message: "Logged in successfully",
          data: {
            token, // For API/mobile clients
            user: safeUserData, // User profile
            sessionActive: true, // Session confirmation
          },
        });
      },
    );
  } catch (error: any) {
    console.error("Login error:", error);

    // Don't leak specific errors
    res.status(500).json({
      success: false,
      message: "Login failed. Please try again later.",
      code: "INTERNAL_ERROR",
    });
  }
};

export { userLogin };
