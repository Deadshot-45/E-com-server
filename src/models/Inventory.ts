import mongoose, { Schema, Document } from "mongoose";

export interface IInventory extends Document {
  variantId: mongoose.Types.ObjectId;

  stock: number; // total available stock
  reserved: number; // locked in cart / checkout
  sold: number; // completed orders

  lowStockThreshold: number;

  updatedAt: Date;
}

const inventorySchema = new Schema({
  variantId: {
    type: Schema.Types.ObjectId,
    ref: "ProductVariant",
    required: true,
    unique: true, // 1:1 mapping
    index: true,
  },

  stock: { type: Number, required: true, min: 0 },
  reserved: { type: Number, default: 0, min: 0 },
});

// // Optional safety
// inventorySchema.pre("save", function (this: IInventory, next) {
//   if (this.stock < 0 || this.reserved < 0) {
//     return next(new Error("Stock values cannot be negative"));
//   }

//   if (this.reserved > this.stock) {
//     return next(new Error("Reserved cannot exceed stock"));
//   }

//   next();
// });
 
// inventorySchema.index({ variantId: 1 });
inventorySchema.index({ stock: 1 });
inventorySchema.index({ updatedAt: -1 });

// const variants = await ProductVariant.find({ productId }).lean();

// const inventory = await Inventory.find({
//   variantId: { $in: variants.map(v => v._id) }
// }).lean();

export const Inventory = mongoose.model<IInventory>(
  "Inventory",
  inventorySchema,
);
