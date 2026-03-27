import mongoose, { Document, Schema } from "mongoose";

export interface IProductCatalog extends Document {
  name: string;
  description?: string;
  categoryId?: mongoose.Types.ObjectId;
  subCategoryId?: mongoose.Types.ObjectId;
  images: { url?: string; isPrimary?: boolean }[];
  createdAt: Date;
  updatedAt: Date;
}

const productCatalogSchema = new Schema<IProductCatalog>(
  {
    name: { type: String, required: true, trim: true },
    description: String,
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      index: true,
    },
    subCategoryId: {
      type: Schema.Types.ObjectId,
      ref: "SubCategory",
      index: true,
    },
    images: [{ url: String, isPrimary: Boolean }],
  },
  { timestamps: true }
);

productCatalogSchema.index({ categoryId: 1, subCategoryId: 1 });

export default mongoose.model<IProductCatalog>("ProductCatalog", productCatalogSchema);
