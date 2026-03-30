import { ISeller } from "../models/Seller.js";

import crypto from "node:crypto";

/**
 * Generate secure 6-character alphanumeric OTP with uppercase letters
 * @param length - OTP length (default: 6)
 * @returns OTP string (e.g., "A7B4X9")
 */
export const generateOTP = (length: number = 6): string => {
  // Secure charset: Numbers + Uppercase letters only (OTP standard)
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += chars[crypto.randomInt(0, chars.length)];
  }

  return otp;
};

/**
 * Generate secure numeric-only OTP (traditional 6-digit)
 */
export const generateNumericOTP = (length: number = 6): string => {
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += crypto.randomInt(0, 9).toString();
  }
  return otp;
};

export const verifyOTPInput = (
  input: string,
  generatedOTP: string,
): boolean => {
  return input.toUpperCase() === generatedOTP; // Case-insensitive
};

export const setOTP = (seller: ISeller, expiresInMinutes = 10): string => {
  const otp = generateOTP();
  seller.otp = otp;
  seller.otpExpiresAt = new Date(Date.now() + expiresInMinutes * 60000);
  return otp;
};

export const verifyOTP = (seller: ISeller, otp: string): boolean => {
  return (
    seller.otp === otp &&
    (seller.otpExpiresAt ? seller.otpExpiresAt > new Date() : false)
  );
};
