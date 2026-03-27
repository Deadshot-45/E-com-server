import mongoose, { Document, Schema } from "mongoose";

export interface ICartItem {
  productId: mongoose.Types.ObjectId;
  sellerId: mongoose.Types.ObjectId;
  quantity: number;
  priceSnapshot: number;
}

export interface ICart extends Document {
  userId: mongoose.Types.ObjectId;
  items: ICartItem[];
  updatedAt: Date;
}

const cartSchema = new Schema<ICart>({
  userId: { type: Schema.Types.ObjectId, unique: true, required: true },
  items: [{
    productId: { type: Schema.Types.ObjectId, required: true },
    sellerId: { type: Schema.Types.ObjectId, required: true },
    quantity: { type: Number, required: true },
    priceSnapshot: { type: Number, required: true }
  }],
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model<ICart>("Cart", cartSchema);