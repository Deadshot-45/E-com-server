import { ISeller } from "../models/Seller.js";

export const generateOTP = (): string => Math.floor(100000 + Math.random() * 900000).toString();

export const setOTP = (seller: ISeller, expiresInMinutes = 10): string => {
  const otp = generateOTP();
  seller.otp = otp;
  seller.otpExpiresAt = new Date(Date.now() + expiresInMinutes * 60000);
  return otp;
};

export const verifyOTP = (seller: ISeller, otp: string): boolean => {
  return seller.otp === otp && (seller.otpExpiresAt ? seller.otpExpiresAt > new Date() : false);
};
