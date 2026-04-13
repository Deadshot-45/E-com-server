import mongoose, { Document, Schema } from "mongoose";

export interface IReview extends Document {
  productId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  sellerId: mongoose.Types.ObjectId;
  rating: number;
  comment?: string;
  createdAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    productId: { type: Schema.Types.ObjectId, index: true, required: true },
    userId: { type: Schema.Types.ObjectId, index: true, required: true },
    sellerId: { type: Schema.Types.ObjectId, index: true, required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model<IReview>("Review", reviewSchema);