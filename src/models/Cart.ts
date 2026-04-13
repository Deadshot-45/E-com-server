// import mongoose, { Document, Schema } from "mongoose";

// export interface ICartItem {
//   productId: mongoose.Types.ObjectId;
//   sellerId: mongoose.Types.ObjectId;
//   quantity: number;
//   priceSnapshot: number;
//   size: string;
// }

// export interface ICart extends Document {
//   userId: mongoose.Types.ObjectId;
//   items: ICartItem[];
//   updatedAt: Date;
// }

// const cartSchema = new Schema<ICart>({
//   userId: { type: Schema.Types.ObjectId, unique: true, required: true },
//   items: [
//     {
//       productId: { type: Schema.Types.ObjectId, required: true },
//       sellerId: { type: Schema.Types.ObjectId, required: true },
//       quantity: { type: Number, required: true },
//       priceSnapshot: { type: Number, required: true },
//       size: { type: String, required: true },
//     },
//   ],
//   updatedAt: { type: Date, default: Date.now },
// });

// export default mongoose.model<ICart>("Cart", cartSchema);


import mongoose, { Schema, Document } from "mongoose";

export interface ICartItem {
  productId: mongoose.Types.ObjectId;
  variantId: mongoose.Types.ObjectId;

  quantity: number;

  // Snapshot for UI (avoid joins)
  name: string;
  price: number;
  image?: string;

  attributes?: {
    color?: string;
    size?: string;
  };
}

export interface ICart extends Document {
  userId: mongoose.Types.ObjectId;

  items: ICartItem[];

  totalItems: number;
  totalAmount: number;

  updatedAt: Date;
  createdAt: Date;
}

const cartItemSchema = new Schema<ICartItem>(
  {
    productId: { type: Schema.Types.ObjectId, required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },

    quantity: { type: Number, required: true, min: 1 },

    // snapshot
    name: String,
    price: Number,
    image: String,

    attributes: {
      color: String,
      size: String,
    },
  },
  { _id: false }
);

const cartSchema = new Schema<ICart>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true },

    items: [cartItemSchema],

    totalItems: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Fast lookup
cartSchema.index({ userId: 1 });

export const Cart = mongoose.model<ICart>("Cart", cartSchema);