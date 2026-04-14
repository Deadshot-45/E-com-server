import mongoose, { Schema, Document } from "mongoose";

export interface IInventory extends Document {
  variantId: mongoose.Types.ObjectId;
  stock: number;
  reserved: number;
  sold: number;
  lowStockThreshold: number;
  updatedAt: Date;
}

const inventorySchema = new Schema({
  variantId: {
    type: Schema.Types.ObjectId,
    ref: "ProductVariant",
    required: true,
    unique: true,
    index: true,
  },
  stock: { type: Number, required: true, min: 0 },
  reserved: { type: Number, default: 0, min: 0 },
});

inventorySchema.index({ stock: 1 });
inventorySchema.index({ updatedAt: -1 });

export const Inventory = mongoose.model<IInventory>(
  "Inventory",
  inventorySchema,
);