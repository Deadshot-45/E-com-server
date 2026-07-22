import crypto from "crypto";
import mongoose from "mongoose";
import { orderService } from "./order-service.js";
import { trackingStore } from "../store/tracking-store.js";
import { Order } from "../models/Order.js";
import { Inventory } from "../models/Inventory.js";
import { Cart } from "../models/Cart.js";
import { Payment } from "../models/Payments.js";
import {
  InitializePaymentInput,
  InitializePaymentResult,
  OrderStatus,
  PaymentStatus,
  PaymentTransaction,
  WebhookEventPayload,
  WebhookLog,
} from "../types/order-tracking.js";
import AppError from "../utils/AppError.js";

export class PaymentService {
  /**
   * Initialize payment with strict Idempotency-Key deduplication.
   */
  public async initializePayment(
    input: InitializePaymentInput
  ): Promise<InitializePaymentResult> {
    if (!input.idempotencyKey) {
      throw new AppError("Idempotency-Key header or field is required", 400);
    }

    if (!input.orderId || !input.amount || !input.currency || !input.gateway) {
      throw new AppError("Missing required payment initialization parameters", 400);
    }

    // Check if idempotent transaction already exists
    const existing = await trackingStore.getPaymentByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      return {
        payment: existing,
        isDuplicate: true,
      };
    }

    const paymentId = `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const gatewayTransactionId = `tx_${input.gateway.toLowerCase()}_${Date.now()}`;

    const newPayment: PaymentTransaction = {
      paymentId,
      orderId: input.orderId,
      amount: input.amount,
      currency: input.currency,
      gateway: input.gateway,
      status: PaymentStatus.INITIATED,
      idempotencyKey: input.idempotencyKey,
      gatewayTransactionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await trackingStore.savePayment(newPayment);

    return {
      payment: newPayment,
      isDuplicate: false,
    };
  }

  /**
   * Get payment details and status by payment ID.
   */
  public async getPaymentStatus(paymentId: string): Promise<PaymentTransaction> {
    const payment = await trackingStore.getPayment(paymentId);
    if (!payment) {
      throw new AppError(`Payment with ID '${paymentId}' not found`, 404);
    }
    return payment;
  }

  /**
   * Process generic payment gateway webhook event idempotently.
   */
  public async processWebhookEvent(payload: WebhookEventPayload): Promise<WebhookLog> {
    if (!payload.eventId || !payload.eventType || !payload.paymentId) {
      throw new AppError("Invalid webhook payload format", 400);
    }

    const isProcessed = await trackingStore.isWebhookProcessed(payload.eventId);
    if (isProcessed) {
      return {
        eventId: payload.eventId,
        paymentId: payload.paymentId,
        eventType: payload.eventType,
        processedAt: new Date().toISOString(),
        status: "IGNORED",
        message: "Duplicate webhook event ignored",
      };
    }

    const payment = await trackingStore.getPayment(payload.paymentId);
    if (!payment) {
      const failLog: WebhookLog = {
        eventId: payload.eventId,
        paymentId: payload.paymentId,
        eventType: payload.eventType,
        processedAt: new Date().toISOString(),
        status: "FAILED",
        message: `Payment '${payload.paymentId}' not found for webhook event`,
      };
      await trackingStore.saveWebhookLog(failLog);
      throw new AppError(`Payment '${payload.paymentId}' not found`, 404);
    }

    let message = "";
    if (payload.eventType === "payment_intent.succeeded") {
      payment.status = PaymentStatus.CAPTURED;
      message = "Payment captured successfully via webhook";

      try {
        await orderService.updateOrderStatus(
          payment.orderId,
          OrderStatus.PAYMENT_AUTHORIZED,
          "Payment Gateway",
          "Payment authorized & captured via webhook"
        );
        if (mongoose.Types.ObjectId.isValid(payment.orderId)) {
          await Order.updateOne(
            { _id: payment.orderId },
            { $set: { paymentStatus: "paid", status: "confirmed" } }
          );
        }
      } catch (err: any) {}
    } else if (payload.eventType === "payment_intent.payment_failed") {
      payment.status = PaymentStatus.FAILED;
      message = "Payment failed via webhook";

      try {
        await orderService.updateOrderStatus(
          payment.orderId,
          OrderStatus.CANCELLED,
          "Payment Gateway",
          "Order cancelled due to payment failure"
        );
        if (mongoose.Types.ObjectId.isValid(payment.orderId)) {
          await Order.updateOne(
            { _id: payment.orderId },
            { $set: { paymentStatus: "failed", status: "cancelled" } }
          );
        }
      } catch (err: any) {}
    } else if (payload.eventType === "charge.refunded") {
      payment.status = PaymentStatus.REFUNDED;
      message = "Payment refunded via webhook";

      if (mongoose.Types.ObjectId.isValid(payment.orderId)) {
        try {
          await Order.updateOne(
            { _id: payment.orderId },
            { $set: { paymentStatus: "refunded" } }
          );
        } catch (err: any) {}
      }
    }

    await trackingStore.savePayment(payment);

    const successLog: WebhookLog = {
      eventId: payload.eventId,
      paymentId: payload.paymentId,
      eventType: payload.eventType,
      processedAt: new Date().toISOString(),
      status: "SUCCESS",
      message,
    };

    await trackingStore.saveWebhookLog(successLog);
    return successLog;
  }

  /**
   * Process verified Stripe Webhook event.
   */
  public async processStripeWebhookEvent(event: any): Promise<WebhookLog> {
    const eventId = event.id;
    const eventType = event.type;
    const dataObject = event.data?.object || {};

    const isProcessed = await trackingStore.isWebhookProcessed(eventId);
    if (isProcessed) {
      return {
        eventId,
        paymentId: dataObject.id || "N/A",
        eventType,
        processedAt: new Date().toISOString(),
        status: "IGNORED",
        message: "Duplicate Stripe webhook event ignored",
      };
    }

    const orderId = dataObject.metadata?.orderId || dataObject.client_reference_id;
    let message = `Stripe event ${eventType} processed successfully`;

    try {
      if (
        eventType === "payment_intent.succeeded" ||
        eventType === "checkout.session.completed"
      ) {
        const paymentIntentId = dataObject.payment_intent || dataObject.id;

        if (orderId) {
          let realOrder: any = null;
          if (mongoose.Types.ObjectId.isValid(orderId)) {
            try {
              realOrder = await Order.findById(orderId).lean();
            } catch (e) {}
          }

          if (mongoose.Types.ObjectId.isValid(orderId)) {
            await Order.updateOne(
              { _id: orderId },
              {
                $set: {
                  paymentStatus: "paid",
                  status: "confirmed",
                  stripePaymentIntentId: paymentIntentId,
                },
              }
            );
          }

          try {
            await orderService.updateOrderStatus(
              orderId,
              OrderStatus.PAYMENT_AUTHORIZED,
              "Stripe Payment Gateway",
              `Payment confirmed & captured via Stripe (${eventType})`
            );
          } catch (e) {}

          if (realOrder) {
            await Payment.findOneAndUpdate(
              { orderId: realOrder._id },
              {
                $set: {
                  userId: realOrder.userId,
                  razorpayOrderId: `stripe_${paymentIntentId}`,
                  method: "online",
                  status: "paid",
                  amount: Math.round((realOrder.totalAmount || 0) * 100),
                  currency: "INR",
                  paidAt: new Date(),
                },
              },
              { upsert: true, new: true }
            );
          }

          const paymentTx = (await trackingStore.getPayment(orderId)) || {
            paymentId: `PAY-${Date.now()}`,
            orderId,
            amount: dataObject.amount ? dataObject.amount / 100 : (realOrder?.totalAmount || 0),
            currency: (dataObject.currency || "INR").toUpperCase(),
            gateway: "STRIPE" as const,
            status: PaymentStatus.CAPTURED,
            idempotencyKey: `STRIPE-IDEM-${paymentIntentId}`,
            gatewayTransactionId: paymentIntentId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          paymentTx.status = PaymentStatus.CAPTURED;
          paymentTx.gatewayTransactionId = paymentIntentId;
          await trackingStore.savePayment(paymentTx);

          if (realOrder && Array.isArray(realOrder.items)) {
            for (const item of realOrder.items) {
              if (item.variantId) {
                await Inventory.updateOne(
                  { variantId: item.variantId },
                  {
                    $inc: {
                      reserved: -item.quantity,
                      sold: item.quantity,
                    },
                  }
                );
              }
            }
          }

          if (realOrder && realOrder.userId) {
            await Cart.updateOne(
              { userId: realOrder.userId },
              { $set: { items: [], totalItems: 0, totalAmount: 0 } }
            );
          }

          message = `SUCCESS: Updated Order, OrderTracking, Payment, PaymentTransaction, Inventory, and Cart for order '${orderId}'`;
        }
      } else if (eventType === "payment_intent.payment_failed") {
        if (orderId) {
          let realOrder: any = null;
          if (mongoose.Types.ObjectId.isValid(orderId)) {
            try {
              realOrder = await Order.findById(orderId).lean();
            } catch (e) {}

            await Order.updateOne(
              { _id: orderId },
              { $set: { paymentStatus: "failed", status: "cancelled" } }
            );
          }

          try {
            await orderService.updateOrderStatus(
              orderId,
              OrderStatus.CANCELLED,
              "Stripe Payment Gateway",
              `Payment failed via Stripe (${dataObject.last_payment_error?.message || "Card declined"})`
            );
          } catch (e) {}

          if (realOrder) {
            await Payment.findOneAndUpdate(
              { orderId: realOrder._id },
              { $set: { status: "failed", failedAt: new Date() } },
              { upsert: true, new: true }
            );
          }

          const paymentTx = await trackingStore.getPayment(orderId);
          if (paymentTx) {
            paymentTx.status = PaymentStatus.FAILED;
            paymentTx.errorMessage = dataObject.last_payment_error?.message || "Payment Failed";
            await trackingStore.savePayment(paymentTx);
          }

          if (realOrder && Array.isArray(realOrder.items)) {
            for (const item of realOrder.items) {
              if (item.variantId) {
                await Inventory.updateOne(
                  { variantId: item.variantId },
                  {
                    $inc: {
                      reserved: -item.quantity,
                      stock: item.quantity,
                    },
                  }
                );
              }
            }
          }

          message = `FAILED: Payment failed for order '${orderId}'. Restored inventory & updated DB status to failed/cancelled.`;
        }
      } else if (eventType === "charge.refunded" || eventType === "charge.refund.updated") {
        if (orderId) {
          let realOrder: any = null;
          if (mongoose.Types.ObjectId.isValid(orderId)) {
            try {
              realOrder = await Order.findById(orderId).lean();
              await Order.updateOne(
                { _id: orderId },
                { $set: { paymentStatus: "refunded" } }
              );
            } catch (e) {}
          }

          if (realOrder) {
            await Payment.findOneAndUpdate(
              { orderId: realOrder._id },
              { $set: { status: "refunded", refundedAt: new Date() } }
            );
          }

          const paymentTx = await trackingStore.getPayment(orderId);
          if (paymentTx) {
            paymentTx.status = PaymentStatus.REFUNDED;
            await trackingStore.savePayment(paymentTx);
          }

          message = `REFUNDED: Payment refunded for order '${orderId}'. Updated DB status to refunded.`;
        }
      }
    } catch (err: any) {
      message = `Error processing Stripe event ${eventType}: ${err.message}`;
    }

    const log: WebhookLog = {
      eventId,
      paymentId: dataObject.id || "STRIPE_EVENT",
      eventType,
      processedAt: new Date().toISOString(),
      status: "SUCCESS",
      message,
    };

    await trackingStore.saveWebhookLog(log);
    return log;
  }

  /**
   * Process verified Razorpay Webhook event.
   */
  public async processRazorpayWebhookEvent(
    rawBody: string | Buffer,
    signature: string
  ): Promise<WebhookLog> {
    const secret =
      process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

    if (secret && signature) {
      const bodyStr = typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(bodyStr)
        .digest("hex");

      if (expectedSignature !== signature) {
        throw new AppError("Razorpay Webhook verification failed: Signature mismatch", 400);
      }
    }

    const event = typeof rawBody === "string" ? JSON.parse(rawBody) : JSON.parse(rawBody.toString("utf-8"));
    const eventId = event.event_id || event.id || `rzp_evt_${Date.now()}`;
    const eventType = event.event;
    const payloadEntity = event.payload?.payment?.entity || event.payload?.order?.entity || {};

    const isProcessed = await trackingStore.isWebhookProcessed(eventId);
    if (isProcessed) {
      return {
        eventId,
        paymentId: payloadEntity.id || "N/A",
        eventType,
        processedAt: new Date().toISOString(),
        status: "IGNORED",
        message: "Duplicate Razorpay webhook event ignored",
      };
    }

    const razorpayOrderId = payloadEntity.order_id || payloadEntity.id;
    let message = `Razorpay event ${eventType} processed`;

    try {
      if (
        eventType === "order.paid" ||
        eventType === "payment.captured" ||
        eventType === "payment.authorized"
      ) {
        let paymentRecord: any = null;
        try {
          paymentRecord = await Payment.findOne({ razorpayOrderId }).lean();
        } catch (e) {}

        const orderId = paymentRecord?.orderId?.toString() || payloadEntity.notes?.orderId || razorpayOrderId;

        if (orderId) {
          let realOrder: any = null;
          if (mongoose.Types.ObjectId.isValid(orderId)) {
            try {
              realOrder = await Order.findById(orderId).lean();
            } catch (e) {}

            await Order.updateOne(
              { _id: orderId },
              { $set: { paymentStatus: "paid", status: "confirmed" } }
            );
          }

          // Update OrderTracking for both custom string order IDs and ObjectId
          try {
            await orderService.updateOrderStatus(
              orderId,
              OrderStatus.PAYMENT_AUTHORIZED,
              "Razorpay Gateway",
              `Payment confirmed & captured via Razorpay (${eventType})`
            );
          } catch (e) {}

          await Payment.updateOne(
            { razorpayOrderId },
            {
              $set: {
                status: "paid",
                paidAt: new Date(),
                razorpayPaymentId: payloadEntity.id,
              },
            }
          );

          const paymentTx = (await trackingStore.getPayment(orderId)) || {
            paymentId: `PAY-${Date.now()}`,
            orderId,
            amount: payloadEntity.amount ? payloadEntity.amount / 100 : (realOrder?.totalAmount || 0),
            currency: "INR",
            gateway: "RAZORPAY" as const,
            status: PaymentStatus.CAPTURED,
            idempotencyKey: `RZP-IDEM-${razorpayOrderId}`,
            gatewayTransactionId: payloadEntity.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          paymentTx.status = PaymentStatus.CAPTURED;
          paymentTx.gatewayTransactionId = payloadEntity.id;
          await trackingStore.savePayment(paymentTx);

          if (realOrder && Array.isArray(realOrder.items)) {
            for (const item of realOrder.items) {
              if (item.variantId) {
                await Inventory.updateOne(
                  { variantId: item.variantId },
                  { $inc: { reserved: -item.quantity, sold: item.quantity } }
                );
              }
            }
          }

          if (realOrder && realOrder.userId) {
            await Cart.updateOne(
              { userId: realOrder.userId },
              { $set: { items: [], totalItems: 0, totalAmount: 0 } }
            );
          }

          message = `SUCCESS: Razorpay payment for order '${orderId}' confirmed & synced across DB`;
        }
      } else if (eventType === "payment.failed") {
        let paymentRecord: any = null;
        try {
          paymentRecord = await Payment.findOne({ razorpayOrderId }).lean();
        } catch (e) {}

        const orderId = paymentRecord?.orderId?.toString() || payloadEntity.notes?.orderId || razorpayOrderId;

        if (orderId) {
          let realOrder: any = null;
          if (mongoose.Types.ObjectId.isValid(orderId)) {
            try {
              realOrder = await Order.findById(orderId).lean();
            } catch (e) {}

            await Order.updateOne(
              { _id: orderId },
              { $set: { paymentStatus: "failed", status: "cancelled" } }
            );
          }

          try {
            await orderService.updateOrderStatus(
              orderId,
              OrderStatus.CANCELLED,
              "Razorpay Gateway",
              "Payment failed via Razorpay Webhook"
            );
          } catch (e) {}

          await Payment.updateOne(
            { razorpayOrderId },
            { $set: { status: "failed", failedAt: new Date() } }
          );

          if (realOrder && Array.isArray(realOrder.items)) {
            for (const item of realOrder.items) {
              if (item.variantId) {
                await Inventory.updateOne(
                  { variantId: item.variantId },
                  { $inc: { reserved: -item.quantity, stock: item.quantity } }
                );
              }
            }
          }

          message = `FAILED: Razorpay payment failed for order '${orderId}'. Inventory restored & order cancelled.`;
        }
      }
    } catch (err: any) {
      message = `Error processing Razorpay event ${eventType}: ${err.message}`;
    }

    const log: WebhookLog = {
      eventId,
      paymentId: payloadEntity.id || "RZP_EVENT",
      eventType,
      processedAt: new Date().toISOString(),
      status: "SUCCESS",
      message,
    };

    await trackingStore.saveWebhookLog(log);
    return log;
  }
}

export const paymentService = new PaymentService();
