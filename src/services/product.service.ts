import mongoose from "mongoose";
import { Product } from "../models/Product.js";
import { ProductVariant } from "../models/ProductVariant.js";
import { Inventory } from "../models/Inventory.js";
import { IProductInput } from "../types/product.types.js";

export const saveProductWithVariants = async (
  payload: IProductInput,
  productId?: string,
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { variants, ...productData } = payload;

    const product = productId
      ? await Product.findByIdAndUpdate(productId, productData, {
          new: true,
          session,
        })
      : await Product.create([productData], { session }).then((r) => r[0]);

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
        { upsert: true, new: true, session },
      );

      await Inventory.findOneAndUpdate(
        { variantId: variant._id },
        { stock: v.stock ?? 0 },
        { upsert: true, session },
      );
    }

    await session.commitTransaction();
    return product;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};