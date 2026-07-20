import express, { Request, Response } from "express";
import { paymentService } from "../services/payment-service.js";
import { constructStripeEvent } from "../utils/stripe.js";

const router = express.Router();

/**
 * POST /api/webhooks/payment
 * Generic/mock payment webhook event handler.
 */
router.post("/payment", async (req: Request, res: Response) => {
  try {
    const { eventId, eventType, paymentId, orderId, status, payload } = req.body;

    const log = await paymentService.processWebhookEvent({
      eventId,
      eventType,
      paymentId,
      orderId,
      status,
      payload,
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      message: log.message,
      data: log,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to process webhook event",
    });
  }
});

/**
 * POST /api/webhooks/stripe
 * Production Stripe Webhook route with Signature Verification.
 * Note: Requires raw body Buffer parsing before global express.json().
 */
router.post("/stripe", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  let event: any;

  try {
    if (process.env.STRIPE_WEBHOOK_SECRET && sig) {
      // Validate cryptographic signature matching from Stripe
      event = constructStripeEvent(req.body, sig);
    } else {
      // Fallback for development/testing when webhook secret is not set
      if (Buffer.isBuffer(req.body)) {
        event = JSON.parse(req.body.toString("utf-8"));
      } else {
        event = req.body;
      }
    }
  } catch (err: any) {
    console.error(`Webhook Signature Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const log = await paymentService.processStripeWebhookEvent(event);
    return res.status(200).json({ received: true, message: log.message, data: log });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/webhooks/razorpay
 * Production Razorpay Webhook route with HMAC-SHA256 Signature Verification.
 */
router.post("/razorpay", async (req: Request, res: Response) => {
  const sig = req.headers["x-razorpay-signature"] as string;

  try {
    const log = await paymentService.processRazorpayWebhookEvent(req.body, sig);
    return res.status(200).json({ status: "ok", message: log.message, data: log });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message });
  }
});

export default router;
