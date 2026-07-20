import mongoose, { Document, Schema } from "mongoose";
import { OrderStatus } from "../types/order-tracking.js";

export interface ITrackingCheckpoint {
  checkpointId: string;
  orderId: string;
  status: OrderStatus;
  location: string;
  description: string;
  timestamp: string;
}

export interface IOrderTracking extends Document {
  orderId: string;
  customerId: string;
  currentStatus: OrderStatus;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  currency: string;
  estimatedDelivery: string;
  checkpoints: ITrackingCheckpoint[];
  createdAt: Date;
  updatedAt: Date;
}

const CheckpointSchema = new Schema<ITrackingCheckpoint>(
  {
    checkpointId: { type: String, required: true },
    orderId: { type: String, required: true },
    status: { type: String, enum: Object.values(OrderStatus), required: true },
    location: { type: String, required: true },
    description: { type: String, required: true },
    timestamp: { type: String, required: true },
  },
  { _id: false }
);

const OrderTrackingSchema = new Schema<IOrderTracking>(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true, index: true },
    currentStatus: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING_PAYMENT,
      index: true,
    },
    items: [
      {
        productId: { type: String, required: true },
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
      },
    ],
    totalAmount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    estimatedDelivery: { type: String, required: true },
    checkpoints: [CheckpointSchema],
  },
  { timestamps: true }
);

export const OrderTrackingModel = mongoose.model<IOrderTracking>(
  "OrderTracking",
  OrderTrackingSchema
);
