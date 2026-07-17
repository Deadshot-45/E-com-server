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

    attributes: {
      size: String,
      color: String,
    },

    price: { type: Number, required: true },
    compareAtPrice: Number,

    images: [
      {
        url: { type: String, required: true },
        isPrimary: { type: Boolean, default: false },
      },
    ],

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

variantSchema.index({
  productId: 1,
  "attributes.color": 1,
});

variantSchema.index({
  productId: 1,
  "attributes.size": 1,
});


variantSchema.index({
  productId: 1,
  sku: 1,
});

variantSchema.index(
  {
    productId: 1,
    "attributes.color": 1,
    "attributes.size": 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      "attributes.color": { $exists: true },
      "attributes.size": { $exists: true },
    },
  }
);

export const ProductVariant = mongoose.model<IProductVariant>(
  "ProductVariant",
  variantSchema,
);
