import mongoose, { Schema, Document } from "mongoose";

export interface IProduct extends Document {
  sellerId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  categoryIds: mongoose.Types.ObjectId[];
  subCategoryId?: mongoose.Types.ObjectId;
  images: { url: string; isPrimary?: boolean }[];
  isActive: boolean;
  bestseller: boolean;
  trending: boolean;
  details?: {
    brand?: string;
    material?: string;
    gender?: "men" | "women" | "unisex";
  };
}

const productSchema = new Schema(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, index: "text" },
    description: String,
    categoryIds: [
      { type: Schema.Types.ObjectId, ref: "Category", index: true },
    ],
    subCategoryId: {
      type: Schema.Types.ObjectId,
      ref: "SubCategory",
      index: true,
    },
    images: [
      {
        url: { type: String, required: true },
        isPrimary: { type: Boolean, default: false },
      },
    ],
    isActive: { type: Boolean, default: true, index: true },
    bestseller: { type: Boolean, default: false },
    trending: { type: Boolean, default: false },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export const Product = mongoose.model<IProduct>("Product", productSchema);