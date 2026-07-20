import { trackingStore } from "../store/tracking-store.js";
import {
  OrderStatus,
  OrderTrackingDetails,
  TrackingCheckpoint,
} from "../types/order-tracking.js";
import AppError from "../utils/AppError.js";

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAYMENT_AUTHORIZED, OrderStatus.CANCELLED],
  [OrderStatus.PAYMENT_AUTHORIZED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

export class OrderService {
  /**
   * Retrieve full order tracking status and history.
   */
  public async getOrderTracking(orderId: string): Promise<OrderTrackingDetails> {
    const order = await trackingStore.getOrder(orderId);
    if (!order) {
      throw new AppError(`Order with ID '${orderId}' not found`, 404);
    }
    return order;
  }

  /**
   * Validate state machine transition.
   */
  public validateTransition(currentStatus: OrderStatus, nextStatus: OrderStatus): boolean {
    if (currentStatus === nextStatus) return true;
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    return allowed.includes(nextStatus);
  }

  /**
   * Advance order status & add tracking checkpoint.
   */
  public async updateOrderStatus(
    orderId: string,
    nextStatus: OrderStatus,
    location: string,
    description: string
  ): Promise<OrderTrackingDetails> {
    const order = await this.getOrderTracking(orderId);

    if (!this.validateTransition(order.currentStatus, nextStatus)) {
      throw new AppError(
        `Invalid status transition from '${order.currentStatus}' to '${nextStatus}'`,
        400
      );
    }

    const checkpoint: TrackingCheckpoint = {
      checkpointId: `CHK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      orderId,
      status: nextStatus,
      location: location || "Logistics Network",
      description: description || `Status updated to ${nextStatus}`,
      timestamp: new Date().toISOString(),
    };

    return await trackingStore.addCheckpoint(checkpoint);
  }
}

export const orderService = new OrderService();
