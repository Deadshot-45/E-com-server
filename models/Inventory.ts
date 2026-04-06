import mongoose, { Document, Schema } from "mongoose";

export interface IInventoryItem {
  size: string;
  quantity: number;
  updatedAt: Date;
}

export interface IInventory extends Document {
  productId: mongoose.Types.ObjectId;
  items: IInventoryItem[];
  createdAt: Date;
  updatedAt: Date;
}

const inventoryItemSchema = new Schema<IInventoryItem>({
  size: { type: String, trim: true, required: true },
  quantity: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

const inventorySchema = new Schema<IInventory>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      unique: true,
      index: true,
    },
    items: {
      type: [inventoryItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

inventorySchema.index({ productId: 1 }, { unique: true });
inventorySchema.index({ "items.size": 1 });
inventorySchema.index({ "items.quantity": 1 });

export const Inventory = mongoose.model<IInventory>("Inventory", inventorySchema);
