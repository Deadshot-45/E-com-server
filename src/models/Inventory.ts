// import mongoose, { Document, Schema } from "mongoose";

// import mongoose, { Schema } from "mongoose";

// export interface IInventoryItem {
//   size: string;
//   quantity: number;
//   updatedAt: Date;
// }

// export interface IInventory extends Document {
//   productId: mongoose.Types.ObjectId;
//   items: IInventoryItem[];
//   createdAt: Date;
//   updatedAt: Date;
// }

// const inventoryItemSchema = new Schema<IInventoryItem>({
//   size: { type: String, trim: true, required: true },
//   quantity: { type: Number, default: 0 },
//   updatedAt: { type: Date, default: Date.now },
// });

// const inventorySchema = new Schema<IInventory>(
//   {
//     productId: {
//       type: Schema.Types.ObjectId,
//       ref: "Product",
//       required: true,
//       unique: true,
//       index: true,
//     },
//     items: {
//       type: [inventoryItemSchema],
//       default: [],
//     },
//   },
//   {
//     timestamps: true,
//   },
// );

// inventorySchema.index({ productId: 1 }, { unique: true });
// inventorySchema.index({ "items.size": 1 });
// inventorySchema.index({ "items.quantity": 1 });

// export const Inventory = mongoose.model<IInventory>("Inventory", inventorySchema);

// export interface IInventory extends Document {
//   variantId: mongoose.Types.ObjectId;

//   quantity: number;
//   reserved: number;

//   lowStockThreshold?: number;

//   updatedAt: Date;
// }

// const inventorySchema = new Schema<IInventory>(
//   {
//     variantId: {
//       type: Schema.Types.ObjectId,
//       ref: "ProductVariant",
//       unique: true,
//       index: true,
//       required: true,
//     },

//     quantity: { type: Number, default: 0 },
//     reserved: { type: Number, default: 0 },

//     lowStockThreshold: Number,
//   },
//   { timestamps: true }
// );

// export const Inventory = mongoose.model<IInventory>(
//   "Inventory",
//   inventorySchema
// );

import mongoose, { Document, Schema } from "mongoose";

export interface IInventory extends Document {
  variantId: mongoose.Types.ObjectId;
  stock: number;
}

const inventorySchema = new Schema<IInventory>(
  {
    variantId: {
      type: Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
      unique: true,
    },
    stock: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Inventory = mongoose.model<IInventory>(
  "Inventory",
  inventorySchema,
);
