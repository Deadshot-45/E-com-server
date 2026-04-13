import mongoose, { Schema, Document } from "mongoose";

export interface IProductVariant extends Document {
  productId: mongoose.Types.ObjectId;
  sellerId: mongoose.Types.ObjectId;

  sku: string;

  attributes: {
    size?: string;
    color?: string;
  };

  price: number;
  compareAtPrice?: number;

  images: { url: string; isPrimary?: boolean }[];

  isActive: boolean;
}

const variantSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      index: true,
      required: true,
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: true,
    },

    sku: { type: String, required: true, unique: true },

    attributes: { type: Schema.Types.Mixed, default: {} },

    price: { type: Number, required: true },
    compareAtPrice: Number,

    images: [
      {
        url: String,
        isPrimary: Boolean,
      },
    ],

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

variantSchema.index({ productId: 1, isActive: 1 });
variantSchema.index({ productId: 1, "attributes.size": 1 });

// variantSchema.index({ productId: 1, isActive: 1 });

export const ProductVariant = mongoose.model<IProductVariant>(
  "ProductVariant",
  variantSchema,
);
