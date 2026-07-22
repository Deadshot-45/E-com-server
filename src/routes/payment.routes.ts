import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  verifyPayment,
  razorpayWebhook,
  getPaymentStatus,
  retryPayment,
} from "../controllers/paymentController.controller.js";

const router = express.Router();

// ─── Payment Verification (Frontend calls after Razorpay checkout) ───────────
/**
 * @swagger
 * /api/payments/verify:
 *   post:
 *     summary: Verify Razorpay payment after checkout
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 */
router.post("/verify", protect, verifyPayment);

// ─── Razorpay Webhook (Server-to-server, no auth) ───────────────────────────
/**
 * @swagger
 * /api/payments/webhook:
 *   post:
 *     summary: Razorpay webhook handler (server-to-server)
 *     tags: [Payments]
 */
router.post("/webhook", razorpayWebhook);

// ─── Payment Status ──────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/payments/status/{orderId}:
 *   get:
 *     summary: Get payment status for an order
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 */
router.get("/status/:orderId", protect, getPaymentStatus);

// ─── Retry Failed Payment ───────────────────────────────────────────────────
/**
 * @swagger
 * /api/payments/retry/{orderId}:
 *   post:
 *     summary: Retry payment for a failed online order
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 */
router.post("/retry/:orderId", protect, retryPayment);

export default router;
