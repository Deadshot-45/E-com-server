// import mongoose, { Document, Schema } from "mongoose";

// export interface ICategory extends Document {
//   name: string;
//   slug?: string;
// }

// export interface ISubCategory extends Document {
//   categoryId: mongoose.Types.ObjectId;
//   name?: string;
//   code?: string;
// }

// export interface IProduct extends Document {
//   sellerId: mongoose.Types.ObjectId;
//   name: string;
//   description?: string;
//   price: number;
//   sku?: string;
//   sizes: string[];
//   inventoryId?: mongoose.Types.ObjectId;
//   bestseller: boolean;
//   trending: boolean;
//   details?: unknown;
//   categoryIds: mongoose.Types.ObjectId[];
//   subCategoryId?: mongoose.Types.ObjectId;
//   images: {
//     url?: string;
//     isPrimary: boolean;
//   }[];
//   isActive: boolean;
//   createdAt: Date;
// }

// const categorySchema = new Schema<ICategory>({
//   name: { type: String, required: true },
//   slug: { type: String, unique: true, index: true },
// });

// const subCategorySchema = new Schema<ISubCategory>({
//   categoryId: { type: Schema.Types.ObjectId, ref: "Category", index: true },
//   name: String,
//   code: { type: String, unique: true, index: true },
// });

// const productSchema = new Schema<IProduct>({
//   sellerId: { type: Schema.Types.ObjectId, index: true, required: true },
//   name: { type: String, required: true },
//   description: String,
//   price: { type: Number, required: true },
//   sku: { type: String, index: true },
//   sizes: [{ type: String, trim: true }],
//   inventoryId: { type: Schema.Types.ObjectId, ref: "Inventory", index: true },
//   bestseller: { type: Boolean, default: false },
//   trending: { type: Boolean, default: false },
//   details: { type: Schema.Types.Mixed, default: {} },
//   categoryIds: [{ type: Schema.Types.ObjectId, ref: "Category", index: true }],
//   subCategoryId: { type: Schema.Types.ObjectId, ref: "SubCategory", index: true },
//   images: [{
//     url: String,
//     isPrimary: { type: Boolean, default: false }
//   }],
//   isActive: { type: Boolean, default: true },
//   createdAt: { type: Date, default: Date.now }
// });

// productSchema.index({ sellerId: 1, categoryIds: 1 });
// productSchema.index({ sellerId: 1, subCategoryId: 1 });
// productSchema.index(
//   { sku: 1 },
//   {
//     unique: true,
//     partialFilterExpression: { sku: { $type: "string" } },
//   },
// );

// export const Category = mongoose.model<ICategory>("Category", categorySchema);
// export const SubCategory = mongoose.model<ISubCategory>("SubCategory", subCategorySchema);
// export const Product = mongoose.model<IProduct>("Product", productSchema);

// import mongoose, { Schema, Document } from "mongoose";

// export interface IProduct extends Document {
//   sellerId: mongoose.Types.ObjectId;
//   name: string;
//   slug: string;
//   description?: string;

//   categoryIds: mongoose.Types.ObjectId[];
//   subCategoryId?: mongoose.Types.ObjectId;

//   brand?: string;

//   tags?: string[];

//   isActive: boolean;
//   isDeleted: boolean;

//   bestseller: boolean;
//   trending: boolean;

//   createdAt: Date;
//   updatedAt: Date;
// }

// const productSchema = new Schema<IProduct>(
//   {
//     sellerId: { type: Schema.Types.ObjectId, required: true, index: true },

//     name: { type: String, required: true, trim: true },
//     slug: { type: String, unique: true, index: true },

//     description: String,

//     categoryIds: [
//       { type: Schema.Types.ObjectId, ref: "Category", index: true },
//     ],
//     subCategoryId: {
//       type: Schema.Types.ObjectId,
//       ref: "SubCategory",
//       index: true,
//     },

//     brand: String,
//     tags: [{ type: String, index: true }],

//     isActive: { type: Boolean, default: true },
//     isDeleted: { type: Boolean, default: false },

//     bestseller: { type: Boolean, default: false },
//     trending: { type: Boolean, default: false },
//   },
//   { timestamps: true },
// );

// // SEO + filtering indexes
// productSchema.index({ sellerId: 1, categoryIds: 1 });
// productSchema.index({ sellerId: 1, subCategoryId: 1 });
// productSchema.index({ name: "text", description: "text" });

// export const Product = mongoose.model<IProduct>("Product", productSchema);

// export interface IProductVariant extends Document {
//   productId: mongoose.Types.ObjectId;
//   sellerId: mongoose.Types.ObjectId;

//   sku: string;

//   attributes: {
//     color?: string;
//     size?: string;
//     material?: string;
//     [key: string]: string | undefined;
//   };

//   price: number;
//   compareAtPrice?: number;

//   images: {
//     url: string;
//     isPrimary: boolean;
//   }[];

//   isActive: boolean;

//   createdAt: Date;
//   updatedAt: Date;
// }

// const variantSchema = new Schema<IProductVariant>(
//   {
//     productId: {
//       type: Schema.Types.ObjectId,
//       ref: "Product",
//       index: true,
//       required: true,
//     },
//     sellerId: { type: Schema.Types.ObjectId, index: true, required: true },

//     sku: { type: String, required: true, unique: true, index: true },

//     attributes: { type: Schema.Types.Mixed, default: {} },

//     price: { type: Number, required: true },
//     compareAtPrice: Number,

//     images: [
//       {
//         url: { type: String, required: true },
//         isPrimary: { type: Boolean, default: false },
//       },
//     ],

//     isActive: { type: Boolean, default: true },
//   },
//   { timestamps: true },
// );

// // Fast filtering
// variantSchema.index({ productId: 1, isActive: 1 });
// variantSchema.index({ "attributes.color": 1 });
// variantSchema.index({ "attributes.size": 1 });

// export const ProductVariant = mongoose.model<IProductVariant>(
//   "ProductVariant",
//   variantSchema,
// );

import mongoose, { Schema, Document } from "mongoose";

export interface IProduct extends Document {
  sellerId: mongoose.Types.ObjectId;
  name: string;
  description?: string;

  categoryIds: mongoose.Types.ObjectId[];
  subCategoryId?: mongoose.Types.ObjectId;

  images: { url: string; isPrimary?: boolean }[];

  isActive: boolean;
  bestseller: boolean;
  trending: boolean;

  details?: {
    brand?: string;
    material?: string;
    gender?: "men" | "women" | "unisex";
  };
}

export interface IInventory extends Document {
  variantId: mongoose.Types.ObjectId;
  stock: number;
  reserved: number;
}

const productSchema = new Schema(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: { type: String, required: true, index: "text" },
    description: String,

    categoryIds: [
      { type: Schema.Types.ObjectId, ref: "Category", index: true },
    ],
    subCategoryId: {
      type: Schema.Types.ObjectId,
      ref: "SubCategory",
      index: true,
    },

    images: [
      {
        url: { type: String, required: true },
        isPrimary: { type: Boolean, default: false },
      },
    ],

    isActive: { type: Boolean, default: true, index: true },
    bestseller: { type: Boolean, default: false },
    trending: { type: Boolean, default: false },

    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export const Product = mongoose.model<IProduct>("Product", productSchema);
