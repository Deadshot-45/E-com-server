import mongoose from "mongoose";
import { Order } from "../models/Order.js";
import { OrderTrackingModel } from "../models/OrderTracking.js";
import { PaymentTransactionModel } from "../models/PaymentTransaction.js";
import { WebhookLogModel } from "../models/WebhookLog.js";
import {
  OrderStatus,
  OrderTrackingDetails,
  PaymentStatus,
  PaymentTransaction,
  TrackingCheckpoint,
  WebhookLog,
} from "../types/order-tracking.js";

export function mapDbStatusToOrderStatus(dbStatus: string): OrderStatus {
  switch (dbStatus?.toLowerCase()) {
    case "pending":
    case "unpaid":
      return OrderStatus.PENDING_PAYMENT;
    case "confirmed":
    case "paid":
      return OrderStatus.PAYMENT_AUTHORIZED;
    case "processing":
      return OrderStatus.PROCESSING;
    case "shipped":
      return OrderStatus.SHIPPED;
    case "delivered":
      return OrderStatus.DELIVERED;
    case "cancelled":
    case "failed":
      return OrderStatus.CANCELLED;
    default:
      return OrderStatus.PENDING_PAYMENT;
  }
}

function getCheckpointDescription(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.PENDING_PAYMENT:
      return "Order submitted. Awaiting payment processing.";
    case OrderStatus.PAYMENT_AUTHORIZED:
      return "Payment confirmed. Order sent to fulfillment.";
    case OrderStatus.PROCESSING:
      return "Order is being packed at fulfillment center.";
    case OrderStatus.SHIPPED:
      return "Order dispatched via logistics carrier.";
    case OrderStatus.DELIVERED:
      return "Order delivered to destination.";
    case OrderStatus.CANCELLED:
      return "Order has been cancelled.";
    default:
      return "Order status updated.";
  }
}

export class TrackingStore {
  private static instance: TrackingStore;

  // Memory fallback maps (used when DB is disconnected or for memory lookup)
  private memoryOrders: Map<string, OrderTrackingDetails> = new Map();
  private memoryPayments: Map<string, PaymentTransaction> = new Map();
  private memoryIdempotencyKeys: Map<string, string> = new Map();
  private memoryWebhookLogs: Map<string, WebhookLog> = new Map();

  private constructor() {}

  public static getInstance(): TrackingStore {
    if (!TrackingStore.instance) {
      TrackingStore.instance = new TrackingStore();
    }
    return TrackingStore.instance;
  }

  private isDbConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }

  // --- Order Methods ---
  public async getOrder(orderId: string): Promise<OrderTrackingDetails | null> {
    if (this.isDbConnected()) {
      // 1. Query OrderTrackingModel
      try {
        const dbTracking = await OrderTrackingModel.findOne({ orderId }).lean();
        if (dbTracking) {
          return {
            orderId: dbTracking.orderId,
            customerId: dbTracking.customerId,
            currentStatus: dbTracking.currentStatus,
            items: dbTracking.items,
            totalAmount: dbTracking.totalAmount,
            currency: dbTracking.currency,
            estimatedDelivery: dbTracking.estimatedDelivery,
            checkpoints: dbTracking.checkpoints,
            createdAt: dbTracking.createdAt ? new Date(dbTracking.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: dbTracking.updatedAt ? new Date(dbTracking.updatedAt).toISOString() : new Date().toISOString(),
          };
        }
      } catch (err) {}

      // 2. Query main Order model if orderId is valid ObjectId
      if (mongoose.Types.ObjectId.isValid(orderId)) {
        try {
          const realOrder = await Order.findById(orderId).lean();
          if (realOrder) {
            const initialStatus = mapDbStatusToOrderStatus(realOrder.status);
            const initialCheckpoint: TrackingCheckpoint = {
              checkpointId: `CHK-${Date.now()}-1`,
              orderId: realOrder._id.toString(),
              status: initialStatus,
              location: "Order System",
              description: getCheckpointDescription(initialStatus),
              timestamp: realOrder.createdAt ? new Date(realOrder.createdAt).toISOString() : new Date().toISOString(),
            };

            const newTracking: OrderTrackingDetails = {
              orderId: realOrder._id.toString(),
              customerId: realOrder.userId?.toString() || "CUST-GUEST",
              currentStatus: initialStatus,
              items: (realOrder.items || []).map((item: any) => ({
                productId: item.productId?.toString() || "",
                name: item.name || "Item",
                quantity: item.quantity || 1,
                price: item.price || 0,
              })),
              totalAmount: realOrder.totalAmount || 0,
              currency: "INR",
              estimatedDelivery: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
              checkpoints: [initialCheckpoint],
              createdAt: realOrder.createdAt ? new Date(realOrder.createdAt).toISOString() : new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            await OrderTrackingModel.create(newTracking);
            return newTracking;
          }
        } catch (err) {}
      }
    }

    return this.memoryOrders.get(orderId) || null;
  }

  public async saveOrder(order: OrderTrackingDetails): Promise<void> {
    order.updatedAt = new Date().toISOString();
    this.memoryOrders.set(order.orderId, order);

    if (this.isDbConnected()) {
      try {
        await OrderTrackingModel.findOneAndUpdate(
          { orderId: order.orderId },
          { $set: order },
          { upsert: true, new: true }
        );
      } catch (err) {}
    }
  }

  public async addCheckpoint(checkpoint: TrackingCheckpoint): Promise<OrderTrackingDetails> {
    let order = await this.getOrder(checkpoint.orderId);

    if (!order) {
      order = {
        orderId: checkpoint.orderId,
        customerId: "CUST-DEFAULT",
        currentStatus: checkpoint.status,
        items: [],
        totalAmount: 0,
        currency: "INR",
        estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        checkpoints: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    order.checkpoints.push(checkpoint);
    order.currentStatus = checkpoint.status;
    order.updatedAt = new Date().toISOString();

    await this.saveOrder(order);
    return order;
  }

  // --- Payment Methods ---
  public async getPayment(paymentId: string): Promise<PaymentTransaction | null> {
    if (this.isDbConnected()) {
      try {
        const dbPayment = await PaymentTransactionModel.findOne({ paymentId }).lean();
        if (dbPayment) {
          return {
            paymentId: dbPayment.paymentId,
            orderId: dbPayment.orderId,
            amount: dbPayment.amount,
            currency: dbPayment.currency,
            gateway: dbPayment.gateway,
            status: dbPayment.status,
            idempotencyKey: dbPayment.idempotencyKey,
            gatewayTransactionId: dbPayment.gatewayTransactionId,
            errorMessage: dbPayment.errorMessage,
            createdAt: dbPayment.createdAt ? new Date(dbPayment.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: dbPayment.updatedAt ? new Date(dbPayment.updatedAt).toISOString() : new Date().toISOString(),
          };
        }
      } catch (err) {}
    }
    return this.memoryPayments.get(paymentId) || null;
  }

  public async getPaymentByIdempotencyKey(key: string): Promise<PaymentTransaction | null> {
    if (this.isDbConnected()) {
      try {
        const dbPayment = await PaymentTransactionModel.findOne({ idempotencyKey: key }).lean();
        if (dbPayment) {
          return {
            paymentId: dbPayment.paymentId,
            orderId: dbPayment.orderId,
            amount: dbPayment.amount,
            currency: dbPayment.currency,
            gateway: dbPayment.gateway,
            status: dbPayment.status,
            idempotencyKey: dbPayment.idempotencyKey,
            gatewayTransactionId: dbPayment.gatewayTransactionId,
            errorMessage: dbPayment.errorMessage,
            createdAt: dbPayment.createdAt ? new Date(dbPayment.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: dbPayment.updatedAt ? new Date(dbPayment.updatedAt).toISOString() : new Date().toISOString(),
          };
        }
      } catch (err) {}
    }

    const paymentId = this.memoryIdempotencyKeys.get(key);
    if (!paymentId) return null;
    return this.getPayment(paymentId);
  }

  public async savePayment(payment: PaymentTransaction): Promise<void> {
    payment.updatedAt = new Date().toISOString();
    this.memoryPayments.set(payment.paymentId, payment);
    this.memoryIdempotencyKeys.set(payment.idempotencyKey, payment.paymentId);

    if (this.isDbConnected()) {
      try {
        await PaymentTransactionModel.findOneAndUpdate(
          { paymentId: payment.paymentId },
          { $set: payment },
          { upsert: true, new: true }
        );
      } catch (err) {}
    }
  }

  // --- Webhook Logs ---
  public async isWebhookProcessed(eventId: string): Promise<boolean> {
    if (this.isDbConnected()) {
      try {
        const exists = await WebhookLogModel.exists({ eventId });
        return exists !== null;
      } catch (err) {}
    }
    return this.memoryWebhookLogs.has(eventId);
  }

  public async saveWebhookLog(log: WebhookLog): Promise<void> {
    this.memoryWebhookLogs.set(log.eventId, log);

    if (this.isDbConnected()) {
      try {
        await WebhookLogModel.findOneAndUpdate(
          { eventId: log.eventId },
          { $set: log },
          { upsert: true, new: true }
        );
      } catch (err) {}
    }
  }

  public async getWebhookLogs(): Promise<WebhookLog[]> {
    if (this.isDbConnected()) {
      try {
        const logs = await WebhookLogModel.find().lean();
        return logs.map((log) => ({
          eventId: log.eventId,
          paymentId: log.paymentId,
          eventType: log.eventType,
          processedAt: log.processedAt,
          status: log.status,
          message: log.message,
        }));
      } catch (err) {}
    }
    return Array.from(this.memoryWebhookLogs.values());
  }
}

export const trackingStore = TrackingStore.getInstance();
