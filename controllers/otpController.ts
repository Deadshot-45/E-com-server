import bcrypt from "bcrypt";
import { Request, Response } from "express";
import OTP from "../models/OTP.js";
import { sendEmail } from "../utils/emailUtility.js";
import { generateOTP } from "../utils/otpUtility.js";

// Validation helper (simple check for email format)
const isValidEmail = (email: string) => /\S+@\S+\.\S+/.test(email);

export const sendOtpHandler = async (req: Request, res: Response) => {
  try {
    const { identifier } = req.body;

    console.log(identifier);

    if (!identifier || !identifier.trim()) {
      return res.status(400).json({
        success: false,
        message: "Identifier (Email/Phone) is required.",
        code: "MISSING_IDENTIFIER",
      });
    }

    const normalizedIdentifier = identifier.trim().toLowerCase();

    // Check if there is an existing OTP that isn't expired yet to prevent spamming
    const existingOTP = await OTP.findOne({ identifier: normalizedIdentifier });
    if (existingOTP) {
      // Check if it was generated less than 1 minute ago (Rate Limiting)
      const oneMinuteAgo = new Date(Date.now() - 60000);
      if (existingOTP.createdAt > oneMinuteAgo) {
        return res.status(429).json({
          success: false,
          message: "Please wait before requesting another OTP.",
          code: "RATE_LIMIT_EXCEEDED",
        });
      }

      // Delete old OTP if we're generating a new one
      await OTP.deleteOne({ _id: existingOTP._id });
    }

    // 1. Generate new 6-digit OTP
    const rawOtp = generateOTP();

    console.log(rawOtp);

    // 2. Hash OTP for secure storage
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(rawOtp, salt);

    // 3. Save to database (Expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const otpDoc = new OTP({
      identifier: normalizedIdentifier,
      otpHash,
      expiresAt,
    });

    await otpDoc.save();

    // 4. Send email (if identifier is an email)
    if (isValidEmail(normalizedIdentifier)) {
      await sendEmail({
        to: normalizedIdentifier,
        subject: "Your Vault Vogue Lite Security Code",
        text: `Your security code is: ${rawOtp}. This code expires in 10 minutes. Please do not share this with anyone.`,
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2>Vault Vogue Lite Security Code</h2>
            <p>Your one-time password is:</p>
            <h1 style="color: #4CAF50; letter-spacing: 5px;">${rawOtp}</h1>
            <p>This code expires in <strong>10 minutes</strong>.</p>
            <p style="font-size: 12px; color: #888;">If you didn't request this code, you can safely ignore this email.</p>
          </div>
        `,
      });
    } else {
      // Future SMS integration would go here
      console.warn(
        `Attempted to send OTP to non-email identifier (${normalizedIdentifier}). SMS not yet configured. Mocking SMS send: ${rawOtp}`,
      );
    }

    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      code: "OTP_SENT",
    });
  } catch (error) {
    console.error("Error in sendOtpHandler:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process OTP request",
      code: "INTERNAL_ERROR",
    });
  }
};

export const verifyOtpHandler = async (req: Request, res: Response) => {
  try {
    const { identifier, otp } = req.body;

    if (!identifier || !otp) {
      return res.status(400).json({
        success: false,
        message: "Identifier and OTP are required.",
        code: "MISSING_FIELDS",
      });
    }

    const normalizedIdentifier = identifier.trim().toLowerCase();

    // Find the OTP document
    const otpDoc = await OTP.findOne({ identifier: normalizedIdentifier });

    if (!otpDoc) {
      return res.status(400).json({
        success: false,
        message: "OTP expired or not found.",
        code: "OTP_NOT_FOUND",
      });
    }

    // Verify the OTP
    const isValid = await bcrypt.compare(otp, otpDoc.otpHash);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP.",
        code: "INVALID_OTP",
      });
    }

    // OTP is valid - delete it so it can't be reused
    await OTP.deleteOne({ _id: otpDoc._id });

    res.status(200).json({
      success: true,
      message: "OTP verified successfully.",
      code: "OTP_VERIFIED",
    });
  } catch (error) {
    console.error("Error in verifyOtpHandler:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
      code: "INTERNAL_ERROR",
    });
  }
};
