import mongoose, { Document, Schema } from "mongoose";

export interface IWebhookLog extends Document {
  eventId: string;
  paymentId: string;
  eventType: string;
  processedAt: string;
  status: "SUCCESS" | "IGNORED" | "FAILED";
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookLogSchema = new Schema<IWebhookLog>(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    paymentId: { type: String, required: true, index: true },
    eventType: { type: String, required: true },
    processedAt: { type: String, required: true },
    status: {
      type: String,
      enum: ["SUCCESS", "IGNORED", "FAILED"],
      required: true,
    },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

export const WebhookLogModel = mongoose.model<IWebhookLog>(
  "WebhookLog",
  WebhookLogSchema
);
