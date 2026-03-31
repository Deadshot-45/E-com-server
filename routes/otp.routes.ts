import { Router } from "express";
import {
  sendOtpHandler,
  verifyOtpHandler,
} from "../controllers/otpController.js";

const router = Router({ mergeParams: true });

/**
 * @swagger
 * /api/ekycController/send:
 *   post:
 *     summary: Request a verification OTP (Email/Phone)
 *     tags: [ekycController]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Email address or phone number
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Missing identifier
 *       429:
 *         description: Rate limit exceeded
 */
router.post("/send", sendOtpHandler);

/**
 * @swagger
 * /api/ekycController/send-otp:
 *   post:
 *     summary: Request a e-mail verification OTP
 *     tags: [ekycController]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Email address to receive the OTP
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Missing identifier
 *       429:
 *         description: Rate limit exceeded (wait before requesting another)
 */
router.post("/send-otp", sendOtpHandler);

/**
 * @swagger
 * /api/ekycController/verify:
 *   post:
 *     summary: Verify an OTP
 *     tags: [ekycController]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *               - otp
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Email address or phone number
 *               otp:
 *                 type: string
 *                 description: The 6-digit OTP code sent
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid or expired OTP
 */
router.post("/verify", verifyOtpHandler);

export default router;
