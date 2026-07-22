import mongoose, { Document, Schema } from "mongoose";

export interface IPayment extends Document {
  orderId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;

  // Razorpay fields
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;

  transactionId?: string;

  method: "cod" | "online";
  status: "created" | "pending" | "paid" | "failed" | "refunded";

  amount: number; // in paise (INR × 100)
  currency: string;

  paidAt?: Date;
  failedAt?: Date;
  refundedAt?: Date;

  refundId?: string;

  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
    },

    razorpayPaymentId: String,
    razorpaySignature: String,

    method: {
      type: String,
      enum: ["cod", "online"],
      required: true,
    },

    status: {
      type: String,
      enum: ["created", "pending", "paid", "failed", "refunded"],
      default: "created",
      index: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "INR",
    },

    paidAt: Date,
    failedAt: Date,
    refundedAt: Date,
    refundId: String,
  },
  { timestamps: true },
);

// Query optimization
paymentSchema.index({ userId: 1, createdAt: -1 });

export const Payment = mongoose.model<IPayment>("Payment", paymentSchema);