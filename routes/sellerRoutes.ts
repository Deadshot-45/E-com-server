import express from "express";
import SellerAuthService from "../services/SellerAuthService.js";
import { sellerAuthMiddleware } from "../middleware/sellerAuthMiddleware.js";

const router = express.Router();

// Register seller
router.post("/register", async (req, res) => {
  try {
    const seller = await SellerAuthService.registerSeller(req.body);
    res.json({ success: true, sellerId: seller._id });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Login seller
router.post("/login", async (req, res) => {
  try {
    const { seller, token } = await SellerAuthService.loginSeller(req.body.email, req.body.password);
    res.json({ success: true, token, sellerId: seller._id });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Send OTP
router.post("/send-otp", sellerAuthMiddleware, async (req, res) => {
  try {
    const otp = await SellerAuthService.sendOTP((req as any).seller._id);
    res.json({ success: true, otp }); // In production, send via SMS/email
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Verify OTP
router.post("/verify-otp", sellerAuthMiddleware, async (req, res) => {
  try {
    await SellerAuthService.verifySellerOTP((req as any).seller._id, req.body.otp);
    res.json({ success: true, message: "Seller verified" });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
