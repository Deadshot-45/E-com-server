import mongoose from "mongoose";
import { Product } from "../models/Product.js";
import { ProductVariant } from "../models/ProductVariant.js";
import { Inventory } from "../models/Inventory.js";
import { Category } from "../models/Category.js";
import { SubCategory } from "../models/SubCategory.js";
import { IProductInput } from "../types/product.types.js";
import { withTransaction } from "../utils/transaction.js";

const SUBCATEGORIES: Record<string, string[]> = {
  Shirt: ["Denim", "Cotton", "Linen", "Formal", "Oversized"],
  Top: ["Crop Top", "Tank Top", "Blouse", "T-Shirt", "Knit Top"],
  Pants: ["Denim", "Trousers", "Cargo", "Wide Leg", "Joggers"],
  Dress: ["Maxi", "Midi", "Mini", "Bodycon", "Shirt Dress"],
  Skirt: ["Denim", "Pleated", "Pencil", "Mini", "Midi"],
  Jacket: ["Denim", "Leather", "Blazer", "Bomber", "Puffer"],
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const getSubCategoryName = (productData: any) => {
  const candidates = [
    productData.subCategory,
    productData.subCategoryName,
    productData.subcategory,
    productData.subcategoryName,
  ];

  return candidates.find((value) => typeof value === "string" && value.trim())?.trim();
};

const ensureSubCategory = async (productData: any, options: Record<string, any> = {}) => {
  if (!productData) return null;

  const existingSubCategoryId = productData.subCategoryId;
  if (
    existingSubCategoryId &&
    (existingSubCategoryId instanceof mongoose.Types.ObjectId ||
      mongoose.Types.ObjectId.isValid(existingSubCategoryId.toString()))
  ) {
    return existingSubCategoryId;
  }

  const subCategoryName = getSubCategoryName(productData);
  if (!subCategoryName) return null;

  const categoryName =
    typeof productData.category === "string"
      ? productData.category.trim()
      : "";

  const categoryKey = Object.keys(SUBCATEGORIES).find(
    (key) => key.toLowerCase() === categoryName.toLowerCase(),
  );

  let categoryDoc = null;

  if (categoryName) {
    categoryDoc = await Category.findOne({
      name: { $regex: new RegExp(`^${escapeRegExp(categoryName)}$`, "i") },
    }).select("_id");
  }

  if (!categoryDoc && Array.isArray(productData.categoryIds) && productData.categoryIds.length > 0) {
    const firstCategoryId = productData.categoryIds[0];
    if (firstCategoryId) {
      categoryDoc = await Category.findById(firstCategoryId).select("_id");
    }
  }

  if (!categoryDoc || !categoryDoc._id) return null;

  const normalizedName = subCategoryName.trim();
  const existingSubCategory = await SubCategory.findOne({
    categoryId: categoryDoc._id,
    name: { $regex: new RegExp(`^${escapeRegExp(normalizedName)}$`, "i") },
  }).select("_id");

  if (existingSubCategory) {
    return existingSubCategory._id;
  }

  const baseCode = `${slugify(categoryName || categoryKey || "category")}-${slugify(normalizedName)}`;
  let code = baseCode;
  let counter = 1;

  while (await SubCategory.exists({ code })) {
    code = `${baseCode}-${counter}`;
    counter += 1;
  }

  const createdSubCategory = await new SubCategory({
    categoryId: categoryDoc._id,
    name: normalizedName,
    code,
    isActive: true,
  }).save(options);

  return createdSubCategory._id;
};

export const saveProductWithVariants = async (
  payload: IProductInput,
  productId?: string,
) => {
  return withTransaction(async (session) => {
    const { variants, ...productData } = payload;
    const options = session ? { session } : {};

    const ensuredSubCategoryId = await ensureSubCategory(productData, options);
    if (ensuredSubCategoryId) {
      productData.subCategoryId = ensuredSubCategoryId;
    }

    const product = productId
      ? await Product.findByIdAndUpdate(productId, productData, {
          new: true,
          ...options,
        })
      : await new Product(productData).save(options);

    if (!product) throw new Error("Product not found");

    for (const v of variants) {
      const variant = await ProductVariant.findOneAndUpdate(
        { sku: v.sku },
        {
          productId: product._id,
          sellerId: product.sellerId,
          attributes: v.attributes ?? {},
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          images: v.images ?? [],
          isActive: true,
        },
        { upsert: true, new: true, ...options },
      );

      await Inventory.findOneAndUpdate(
        { variantId: variant._id },
        { stock: v.stock ?? 0 },
        { upsert: true, ...options },
      );
    }

    return product;
  });
};