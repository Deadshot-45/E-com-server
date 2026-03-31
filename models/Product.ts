import mongoose, { Document, Schema } from "mongoose";

export interface ICategory extends Document {
  name: string;
  slug?: string;
}

export interface ISubCategory extends Document {
  categoryId: mongoose.Types.ObjectId;
  name?: string;
  code?: string;
}

export interface IProduct extends Document {
  sellerId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  price: number;
  sku?: string;
  bestseller: boolean;
  trending: boolean;
  details?: unknown;
  categoryIds: mongoose.Types.ObjectId[];
  subCategoryId?: mongoose.Types.ObjectId;
  inventory: {
    quantity: number;
    updatedAt: Date;
  };
  images: {
    url?: string;
    isPrimary: boolean;
  }[];
  isActive: boolean;
  createdAt: Date;
}

const categorySchema = new Schema<ICategory>({
  name: { type: String, required: true },
  slug: { type: String, unique: true, index: true },
});

const subCategorySchema = new Schema<ISubCategory>({
  categoryId: { type: Schema.Types.ObjectId, ref: "Category", index: true },
  name: String,
  code: { type: String, unique: true, index: true },
});

const productSchema = new Schema<IProduct>({
  sellerId: { type: Schema.Types.ObjectId, index: true, required: true },
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  sku: { type: String, unique: true, index: true },
  bestseller: { type: Boolean, default: false },
  trending: { type: Boolean, default: false },
  details: { type: Schema.Types.Mixed, default: {} },
  categoryIds: [{ type: Schema.Types.ObjectId, ref: "Category", index: true }],
  subCategoryId: { type: Schema.Types.ObjectId, ref: "SubCategory", index: true },
  inventory: {
    quantity: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now }
  },
  images: [{
    url: String,
    isPrimary: { type: Boolean, default: false }
  }],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

productSchema.index({ sellerId: 1, categoryIds: 1 });
productSchema.index({ sellerId: 1, subCategoryId: 1 });

export const Category = mongoose.model<ICategory>("Category", categorySchema);
export const SubCategory = mongoose.model<ISubCategory>("SubCategory", subCategorySchema);
export const Product = mongoose.model<IProduct>("Product", productSchema);
