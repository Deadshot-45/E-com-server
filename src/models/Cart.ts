import mongoose, { Schema, Document } from "mongoose";

export interface ICartItem {
  variantId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;

  quantity: number;

  priceSnapshot: number; // price at time of adding to cart

  size?: string;
  color?: string;

  sellerId: mongoose.Types.ObjectId;

  isSelected: boolean;
  appliedCouponId: mongoose.Types.ObjectId;
  discountAmount: number;
}

export interface ICart extends Document {
  userId: mongoose.Types.ObjectId;

  items: ICartItem[];

  totalItems: number;
  totalAmount: number;

  updatedAt: Date;
}

const cartItemSchema = new Schema<ICartItem>(
  {
    variantId: {
      type: Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
    },

    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    priceSnapshot: {
      type: Number,
      required: true,
    },

    size: String,
    color: String,

    // ✅ ADD THESE (IMPORTANT)
    isSelected: {
      type: Boolean,
      default: true,
    },

    appliedCouponId: {
      type: Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },

    discountAmount: {
      type: Number,
      default: 0,
    },
  },
  { _id: false },
);

const cartSchema = new Schema<ICart>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    items: [cartItemSchema],

    totalItems: {
      type: Number,
      default: 0,
    },

    totalAmount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

cartSchema.index({ userId: 1 });
cartSchema.index(
  { userId: 1, "items.variantId": 1 },
  { unique: true, sparse: true },
);

export const Cart = mongoose.model<ICart>("Cart", cartSchema);
