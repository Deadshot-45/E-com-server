import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: "customer" | "admin" | "seller";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, unique: true, index: true, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: {type: String, required: true, trim: true},
    role: {
      type: String,
      enum: ["customer", "admin", "seller"],
      index: true,
      default: "customer",
    },
    isActive: { type: Boolean, default: true },
  },
  { versionKey: false, timestamps: true }
);

export default mongoose.model<IUser>("User", userSchema);
