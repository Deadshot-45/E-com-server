import mongoose, { Document, Schema } from "mongoose";

export interface IOTP extends Document {
  identifier: string; // email or phone
  otpHash: string;
  expiresAt: Date;
  createdAt: Date;
}

const otpSchema = new Schema<IOTP>(
  {
    identifier: { type: String, required: true },
    otpHash: { type: String, required: true },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: "0s" }, // MongoDB will automatically delete the doc when current date reaches expiresAt
    },
  },
  { versionKey: false, timestamps: true }
);

export default mongoose.model<IOTP>("OTP", otpSchema);
