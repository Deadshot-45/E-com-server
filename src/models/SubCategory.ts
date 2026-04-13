import mongoose, { Document, Schema } from "mongoose";

export interface ISubCategory extends Document {
  categoryId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  isActive: boolean;
}

const subCategorySchema = new Schema<ISubCategory>(
  {
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, unique: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

subCategorySchema.index({ categoryId: 1, name: 1 });

export const SubCategory = mongoose.model<ISubCategory>(
  "SubCategory",
  subCategorySchema,
);

