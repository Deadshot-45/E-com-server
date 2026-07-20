export enum OrderStatus {
  PENDING_PAYMENT = "PENDING_PAYMENT",
  PAYMENT_AUTHORIZED = "PAYMENT_AUTHORIZED",
  PROCESSING = "PROCESSING",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
}

export enum PaymentStatus {
  INITIATED = "INITIATED",
  AUTHORIZED = "AUTHORIZED",
  CAPTURED = "CAPTURED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

export type PaymentGateway = "STRIPE" | "RAZORPAY" | "MOCK_GATEWAY";

export interface OrderItemSummary {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface TrackingCheckpoint {
  checkpointId: string;
  orderId: string;
  status: OrderStatus;
  location: string;
  description: string;
  timestamp: string;
}

export interface OrderTrackingDetails {
  orderId: string;
  customerId: string;
  currentStatus: OrderStatus;
  items: OrderItemSummary[];
  totalAmount: number;
  currency: string;
  estimatedDelivery: string;
  checkpoints: TrackingCheckpoint[];
  createdAt: string;
  updatedAt: string;
}

export interface PaymentTransaction {
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
  gateway: PaymentGateway;
  status: PaymentStatus;
  idempotencyKey: string;
  gatewayTransactionId?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InitializePaymentInput {
  orderId: string;
  amount: number;
  currency: string;
  gateway: PaymentGateway;
  idempotencyKey: string;
}

export interface InitializePaymentResult {
  payment: PaymentTransaction;
  isDuplicate: boolean;
}

export interface WebhookEventPayload {
  eventId: string;
  eventType: "payment_intent.succeeded" | "payment_intent.payment_failed" | "charge.refunded";
  paymentId: string;
  orderId: string;
  status: PaymentStatus;
  signature?: string;
  payload?: Record<string, any>;
  timestamp: string;
}

export interface WebhookLog {
  eventId: string;
  paymentId: string;
  eventType: string;
  processedAt: string;
  status: "SUCCESS" | "IGNORED" | "FAILED";
  message: string;
}
