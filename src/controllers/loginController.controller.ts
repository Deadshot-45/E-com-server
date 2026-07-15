import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Customer from "../models/Customer.js";
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
    const term = identifier.trim();
    let user: any = null;
    let customer: any = null;

    if (term.includes("@")) {
      // Find user by email
      user = await User.findOne({ email: term.toLowerCase() });
    } else {
      // Find customer by phone number
      customer = await Customer.findOne({ phoneNumber: term });
      if (customer) {
        user = await User.findById(customer.userId);
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
        code: "INVALID_CREDENTIALS",
      });
    }

    const isPasswordValid = await comparePassword(password, user.passwordHash);
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
        role: user.role || "customer",
      },
      process.env.JWT_SECRET!,
      { expiresIn: "2h" },
    );

    // Merge User & Customer data to maintain frontend compatibility
    if (!customer && user.role === "customer") {
      customer = await Customer.findOne({ userId: user._id });
    }

    const safeUserData = {
      id: user._id,
      email: user.email,
      role: user.role,
      name: customer?.fullName || user?.name || "User",
      gender: customer?.gender,
      phoneNumber: customer?.phoneNumber,
      address: customer?.address,
      profilePicture: customer?.profilePicture,
    };

    console.log("Login Data : ", safeUserData)

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

        res.json({
          success: true,
          message: "Logged in successfully",
          data: {
            token,
            user: safeUserData,
            sessionActive: true,
          },
        });
      },
    );
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({
      success: false,
      message: "Login failed. Please try again later.",
      code: "INTERNAL_ERROR",
    });
  }
};

const forgotPassword = async (
  req: express.Request<{}, {}, { email: string; phone: string, identifier?: string }>,
  res: express.Response,
  next: express.NextFunction,
) => {
  const { email, phone } = req.body;

  if (!email?.trim() && !phone?.trim()) {
    return res.status(400).json({
      success: false,
      message: "Email or phone number is required.",
      code: "MISSING_EMAIL",
    });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase(), phoneNumber: phone });
    if (!user) {
      return res.status(200).json({
        success: false,
        message: "User not found with given Email/Phone.",
        code: "USER_NOT_FOUND",
      });
    }

     ;

    // Here you would typically generate a password reset token and send an email
    // For now, we'll just return a success message
    req.body = {email, phone, identifier : email || phone};
    next(); // Call the next middleware (sendOtpHandler) to send the OTP
  } catch (err: any) {
    console.error("Forgot password error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to process forgot password request.",
      code: "INTERNAL_ERROR",
    });
  }
};

export { userLogin, forgotPassword };
