import mongoose, { Document, Schema } from "mongoose";

export interface IProductVariant extends Document {
  productId: mongoose.Types.ObjectId;
  sellerId: mongoose.Types.ObjectId;
  sku: string;
  attributes: Record<string, any>;
  price: number;
  compareAtPrice?: number;
  images: string[];
  isActive: boolean;
}

const variantSchema = new Schema<IProductVariant>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    sku: { type: String, required: true, unique: true },

    attributes: { type: Object, default: {} },

    price: { type: Number, required: true },
    compareAtPrice: Number,

    images: [{ type: String }],

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const ProductVariant = mongoose.model<IProductVariant>(
  "ProductVariant",
  variantSchema,
);