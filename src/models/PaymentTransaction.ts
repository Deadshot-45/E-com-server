import mongoose, { Document, Schema } from "mongoose";
import { PaymentGateway, PaymentStatus } from "../types/order-tracking.js";

export interface IPaymentTransaction extends Document {
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
  gateway: PaymentGateway;
  status: PaymentStatus;
  idempotencyKey: string;
  gatewayTransactionId?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    paymentId: { type: String, required: true, unique: true, index: true },
    orderId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    gateway: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.INITIATED,
      index: true,
    },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    gatewayTransactionId: { type: String },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

export const PaymentTransactionModel = mongoose.model<IPaymentTransaction>(
  "PaymentTransaction",
  PaymentTransactionSchema
);
