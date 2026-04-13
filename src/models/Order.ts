// import mongoose, { Document, Schema } from "mongoose";

// export interface IOrderItem {
//   sellerProductId: mongoose.Types.ObjectId;
//   productId: mongoose.Types.ObjectId;
//   variantId: mongoose.Types.ObjectId;
//   productName?: string;
//   attributes?: {
//     color?: string;
//     size?: string;
//     material?: string;
//   };
//   price: number;
//   quantity: number;
// }

// export interface IOrder extends Document {
//   userId: mongoose.Types.ObjectId;
//   sellers: {
//     sellerId: mongoose.Types.ObjectId;
//     status: "pending" | "paid" | "shipped" | "delivered" | "cancelled";
//   }[];
//   items: IOrderItem[];
//   totalAmount: number;
//   shippingAddress?: {
//     city?: string;
//     state?: string;
//     country?: string;
//     postalCode?: string;
//   };
//   paymentStatus: "pending" | "paid" | "failed" | "refunded";
//   trackingNumber?: string;
//   createdAt: Date;
//   updatedAt: Date;
//   cancelledAt?: Date;
// }

// const orderItemSchema = new Schema<IOrderItem>(
//   {
//     sellerProductId: {
//       type: Schema.Types.ObjectId,
//       ref: "SellerProduct",
//       required: true,
//       index: true,
//     },
//     productId: {
//       type: Schema.Types.ObjectId,
//       ref: "ProductCatalog",
//       required: true,
//       index: true,
//     },
//     variantId: {
//       type: Schema.Types.ObjectId,
//       required: true,
//     },
//     productName: String,
//     attributes: {
//       color: String,
//       size: String,
//       material: String,
//     },
//     price: { type: Number, required: true },
//     quantity: { type: Number, required: true },
//   },
//   { _id: false },
// );

// const orderSchema = new Schema<IOrder>({
//   userId: {
//     type: Schema.Types.ObjectId,
//     ref: "User",
//     index: true,
//     required: true,
//   },
//   sellers: [
//     {
//       sellerId: { type: Schema.Types.ObjectId, ref: "Seller" },
//       status: {
//         type: String,
//         enum: ["pending", "paid", "shipped", "delivered", "cancelled"],
//         default: "pending",
//         index: true,
//       },
//     },
//   ],
//   items: [orderItemSchema],
//   totalAmount: { type: Number, required: true },
//   shippingAddress: {
//     city: String,
//     state: String,
//     country: String,
//     postalCode: String,
//   },
//   paymentStatus: {
//     type: String,
//     enum: ["pending", "paid", "failed", "refunded"],
//     default: "pending",
//   },
//   trackingNumber: String,
//   cancelledAt: Date,
// }, { timestamps: true });

// orderSchema.index({ userId: 1, createdAt: -1 });
// orderSchema.index({ "sellers.sellerId": 1 });
// orderSchema.index({ paymentStatus: 1 });

// export default mongoose.model<IOrder>("Order", orderSchema);

import mongoose, { Schema, Document } from "mongoose";

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  variantId: mongoose.Types.ObjectId;

  name: string;
  sku: string;

  price: number;
  quantity: number;

  image?: string;

  attributes?: {
    color?: string;
    size?: string;
  };
}

export interface IOrder extends Document {
  userId: mongoose.Types.ObjectId;

  items: IOrderItem[];

  totalAmount: number;
  totalItems: number;

  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";

  paymentStatus: "pending" | "paid" | "failed" | "refunded";

  paymentMethod: "cod" | "online";

  address: {
    fullName: string;
    phone: string;
    addressLine: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };

  placedAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },

    name: String,
    sku: String,

    price: Number,
    quantity: Number,

    image: String,

    attributes: {
      color: String,
      size: String,
    },
  },
  { _id: false },
);

const orderSchema = new Schema<IOrder>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },

    items: [orderItemSchema],

    totalAmount: { type: Number, required: true },
    totalItems: { type: Number, required: true },

    status: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
      default: "pending",
      index: true,
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },

    paymentMethod: {
      type: String,
      enum: ["cod", "online"],
      required: true,
    },

    address: {
      fullName: String,
      phone: String,
      addressLine: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },

    placedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Query optimization
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });

export const Order = mongoose.model<IOrder>("Order", orderSchema);
