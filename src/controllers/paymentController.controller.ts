import { Request, Response } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import { withTransaction } from "../utils/transaction.js";
import { Payment } from "../models/Payment.js";
import { Order } from "../models/Order.js";
import { Inventory } from "../models/Inventory.js";
import { getRazorpay } from "../config/razorpay.js";

// ─────────────────────────────────────────────────────────────────────────────
// 1️⃣  VERIFY PAYMENT  →  Frontend calls after Razorpay checkout completes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/payments/verify:
 *   post:
 *     summary: Verify Razorpay payment signature
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - razorpay_order_id
 *               - razorpay_payment_id
 *               - razorpay_signature
 *             properties:
 *               razorpay_order_id:
 *                 type: string
 *                 example: order_ABC123XYZ
 *               razorpay_payment_id:
 *                 type: string
 *                 example: pay_DEF456UVW
 *               razorpay_signature:
 *                 type: string
 *                 example: "abcdef1234567890..."
 *     responses:
 *       200:
 *         description: Payment verified and order confirmed
 *       400:
 *         description: Payment verification failed
 *       404:
 *         description: Payment record not found
 */
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const result = await withTransaction(async (session) => {
      const userId = req.user?._id;
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
        req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw new Error("Missing payment verification fields");
      }

      // 1️⃣ Verify signature
      const secret = process.env.RAZORPAY_KEY_SECRET;
      if (!secret) {
        throw new Error("Razorpay secret not configured");
      }

      const generatedSignature = crypto
        .createHmac("sha256", secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (generatedSignature !== razorpay_signature) {
        // Signature mismatch → payment tampered
        await Payment.updateOne(
          { razorpayOrderId: razorpay_order_id },
          { status: "failed", failedAt: new Date() },
          { session },
        );

        throw new Error("Payment verification failed — signature mismatch");
      }

      // 2️⃣ Find and update payment record
      const payment = await Payment.findOne({
        razorpayOrderId: razorpay_order_id,
        userId,
      }).session(session || null);

      if (!payment) {
        throw new Error("Payment record not found");
      }

      if (payment.status === "paid") {
        return {
          success: true,
          message: "Payment already verified",
          statusCode: 200,
        };
      }

      payment.razorpayPaymentId = razorpay_payment_id;
      payment.razorpaySignature = razorpay_signature;
      payment.status = "paid";
      payment.paidAt = new Date();
      await payment.save({ session });

      // 3️⃣ Update order status
      const order = await Order.findById(payment.orderId).session(session || null);

      if (!order) {
        throw new Error("Associated order not found");
      }

      order.status = "confirmed";
      order.paymentStatus = "paid";
      await order.save({ session });

      // 4️⃣ Finalize inventory — move from reserved to sold
      for (const item of order.items) {
        await Inventory.updateOne(
          { variantId: item.variantId },
          {
            $inc: {
              reserved: -item.quantity,
              sold: item.quantity,
            },
          },
          { session },
        );
      }

      return {
        success: true,
        message: "Payment verified and order confirmed",
        data: {
          orderId: order._id,
          paymentId: payment._id,
          status: order.status,
          paymentStatus: order.paymentStatus,
        },
        statusCode: 200,
      };
    });

    return res.status(result.statusCode || 200).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Payment verification failed",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2️⃣  RAZORPAY WEBHOOK  →  Server-to-server payment event handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/payments/webhook:
 *   post:
 *     summary: Razorpay webhook handler
 *     tags: [Payments]
 *     description: >
 *       Razorpay sends server-to-server notifications for payment events.
 *       This endpoint verifies the webhook signature and processes the event.
 *       Do NOT call this from your frontend.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed
 *       400:
 *         description: Invalid webhook signature
 */
export const razorpayWebhook = async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("RAZORPAY_WEBHOOK_SECRET not configured");
      return res.status(500).json({ success: false });
    }

    // Verify webhook signature
    const signature = req.headers["x-razorpay-signature"] as string;
    const body = JSON.stringify(req.body);

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    switch (event) {
      case "payment.captured": {
        const razorpayOrderId = payload.payment.entity.order_id;
        const razorpayPaymentId = payload.payment.entity.id;

        try {
          await withTransaction(async (session) => {
            const payment = await Payment.findOne({
              razorpayOrderId,
            }).session(session || null);

            if (payment && payment.status !== "paid") {
              payment.razorpayPaymentId = razorpayPaymentId;
              payment.status = "paid";
              payment.paidAt = new Date();
              await payment.save({ session });

              const order = await Order.findById(payment.orderId).session(
                session || null,
              );
              if (order && order.status === "pending") {
                order.status = "confirmed";
                order.paymentStatus = "paid";
                await order.save({ session });

                // Finalize inventory
                for (const item of order.items) {
                  await Inventory.updateOne(
                    { variantId: item.variantId },
                    {
                      $inc: {
                        reserved: -item.quantity,
                        sold: item.quantity,
                      },
                    },
                    { session },
                  );
                }
              }
            }
          });
        } catch (err) {
          console.error("Webhook payment.captured error:", err);
        }
        break;
      }

      case "payment.failed": {
        const razorpayOrderId = payload.payment.entity.order_id;

        const payment = await Payment.findOne({ razorpayOrderId });
        if (payment && payment.status !== "paid") {
          payment.status = "failed";
          payment.failedAt = new Date();
          await payment.save();

          // Release inventory reservations
          const order = await Order.findById(payment.orderId);
          if (order) {
            order.paymentStatus = "failed";
            await order.save();

            for (const item of order.items) {
              await Inventory.updateOne(
                { variantId: item.variantId },
                { $inc: { reserved: -item.quantity } },
              );
            }
          }
        }
        break;
      }

      default:
        console.log(`Unhandled Razorpay webhook event: ${event}`);
    }

    // Always return 200 to acknowledge receipt
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return res.status(200).json({ success: true }); // Still 200 to prevent retries
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3️⃣  GET PAYMENT STATUS  →  Check payment status for an order
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/payments/status/{orderId}:
 *   get:
 *     summary: Get payment status for an order
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment status retrieved
 *       404:
 *         description: Payment not found
 */
export const getPaymentStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const { orderId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const payment = await Payment.findOne({ orderId, userId }).lean();

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        status: payment.status,
        method: payment.method,
        amount: payment.amount / 100, // Convert paise back to INR
        currency: payment.currency,
        paidAt: payment.paidAt,
        razorpayPaymentId: payment.razorpayPaymentId,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch payment status",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4️⃣  RETRY PAYMENT  →  Create new Razorpay order for a failed payment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/payments/retry/{orderId}:
 *   post:
 *     summary: Retry payment for a failed online order
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: New Razorpay order created for retry
 *       400:
 *         description: Payment cannot be retried
 *       404:
 *         description: Order not found
 */
export const retryPayment = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const { orderId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.status !== "pending" || order.paymentMethod !== "online") {
      return res.status(400).json({
        success: false,
        message: "Only pending online orders can be retried",
      });
    }

    // Create new Razorpay order
    const razorpayOrder = await getRazorpay().orders.create({
      amount: Math.round(order.totalAmount * 100),
      currency: "INR",
      receipt: order._id.toString(),
      notes: {
        orderId: order._id.toString(),
        userId: userId.toString(),
        retry: "true",
      },
    });

    // Update payment record with new Razorpay order ID
    await Payment.updateOne(
      { orderId: order._id, userId },
      {
        razorpayOrderId: razorpayOrder.id,
        status: "created",
        razorpayPaymentId: undefined,
        razorpaySignature: undefined,
      },
    );

    return res.status(200).json({
      success: true,
      message: "New payment order created. Complete payment.",
      data: {
        razorpay: {
          orderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          key: process.env.RAZORPAY_KEY_ID,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retry payment",
    });
  }
};
