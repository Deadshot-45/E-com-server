import mongoose, { Document, Schema } from "mongoose";

export interface IBankDetails {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  ifscCode: string;
  accountType: "savings" | "current";
}

export interface ISeller extends Document {
  name: string; // Business name
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
  
  // Onboarding Business & Payout details
  status: "pending" | "approved" | "rejected" | "suspended";
  gstNumber?: string;
  website?: string;
  category?: string;
  description?: string;
  bankDetails?: IBankDetails;

  createdAt: Date;
  updatedAt: Date;
}

const bankDetailsSchema = new Schema<IBankDetails>({
  bankName: { type: String, trim: true },
  accountHolder: { type: String, trim: true },
  accountNumber: { type: String, trim: true },
  ifscCode: { type: String, trim: true },
  accountType: { type: String, enum: ["savings", "current"], default: "savings" },
}, { _id: false });

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
    
    // Status and onboarding info
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending",
      index: true
    },
    gstNumber: { type: String, trim: true },
    website: { type: String, trim: true },
    category: { type: String, trim: true },
    description: { type: String },
    bankDetails: { type: bankDetailsSchema },
  },
  { timestamps: true }
);

export default mongoose.model<ISeller>("Seller", sellerSchema);
