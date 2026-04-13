import mongoose, { Document, Schema } from "mongoose";

export interface ISeller extends Document {
  name: string;
  ownerUserId: mongoose.Types.ObjectId;
  contactEmail?: string;
  contactPhone?: string;
  passwordHash: string;
  jwtToken?: string;
  lastLogin?: Date;
  isVerified: boolean;
  otp?: string;
  otpExpiresAt?: Date;
  isActive: boolean;
  averageRating: number;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const sellerSchema = new Schema<ISeller>(
  {
    name: { type: String, required: true, trim: true },
    ownerUserId: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    contactPhone: { type: String, trim: true },
    passwordHash: { type: String, required: true },
    jwtToken: { type: String },
    lastLogin: { type: Date },
    isVerified: { type: Boolean, default: false },
    otp: { type: String },
    otpExpiresAt: { type: Date },
    isActive: { type: Boolean, default: true, index: true },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model<ISeller>("Seller", sellerSchema);
