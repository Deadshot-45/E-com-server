import mongoose, { Document, Schema } from "mongoose";

export interface IPayment extends Document {
  orderId: mongoose.Types.ObjectId;
  method: string;
  status: string;
  transactionId?: string;
  amount: number;
  paidAt?: Date;
}

const paymentSchema = new Schema<IPayment>({
  orderId: { type: Schema.Types.ObjectId, index: true, required: true },
  method: String,
  status: String,
  transactionId: String,
  amount: Number,
  paidAt: Date
});

export default mongoose.model<IPayment>("Payment", paymentSchema);