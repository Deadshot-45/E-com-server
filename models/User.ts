import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  name?: string;
  email: string;
  passwordHash: string;
  role: "customer" | "admin";
  gender?: "male" | "female" | "other";
  fullName: string;
  profilePicture?: string;
  phoneNumber?: string;
  address?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: String,
    email: { type: String, unique: true, index: true, required: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["customer", "admin"],
      index: true,
      default: "customer",
    },
    gender: { type: String, enum: ["male", "female", "other"] },
    fullName: { type: String, required: true },
    profilePicture: String,
    phoneNumber: { type: String, unique: true, index: true, sparse: true },
    address: String,
    isActive: { type: Boolean, default: true },
  },
  { versionKey: false, timestamps: true }
);

export default mongoose.model<IUser>("User", userSchema);
