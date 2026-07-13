import mongoose, { Document, Schema } from "mongoose";

export interface ICustomer extends Document {
  userId: mongoose.Types.ObjectId;
  fullName: string;
  gender?: "male" | "female" | "other";
  profilePicture?: string;
  phoneNumber?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User", unique: true, index: true },
    fullName: { type: String, required: true, trim: true },
    gender: { type: String, enum: ["male", "female", "other"] },
    profilePicture: String,
    phoneNumber: { type: String, unique: true, index: true, sparse: true, trim: true },
    address: String,
  },
  { timestamps: true }
);

export default mongoose.model<ICustomer>("Customer", customerSchema);
