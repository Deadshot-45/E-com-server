import { Types } from "mongoose";
import { Product } from "../src/models/Product.ts";
import { ProductVariant } from "../src//models/ProductVariant.ts";
import { Inventory } from "../src//models/Inventory.ts";
import rawData from "../DB_Insert_Cmd/products.js";

import mongoose from "mongoose";

// type RawProduct = {
//     name?: string;
//     images?: {
//       url: string;
//       isPrimary: boolean;
//     }[];
//   };

const SIZES = ["S", "M", "L", "XL"];

export const mapMinimalProduct = async (raw) => {
  try {
    if (!raw?.name) {
      console.warn("⚠️ Skipping product (no name):", raw);
      return;
    }

    const product = await Product.create({
      _id: new Types.ObjectId(),

      sellerId: raw?.sellerId?.$oid
        ? new Types.ObjectId(raw.sellerId.$oid)
        : new Types.ObjectId(),

      name: raw?.name?.trim() || "Untitled Product",

      description:
        "A premium Vault Vogue product designed for everyday comfort and clean styling.",

      categoryIds: raw?.categoryIds?.length
        ? raw.categoryIds.map((c) => new Types.ObjectId(c.$oid))
        : [new Types.ObjectId()],

      subCategoryId: raw?.subCategoryId?.$oid
        ? new Types.ObjectId(raw.subCategoryId.$oid)
        : new Types.ObjectId(),

      images:
        Array.isArray(raw.images) && raw.images.length > 0
          ? raw.images
          : [
              {
                url: "/images/placeholder.png",
                isPrimary: true,
              },
            ],

      isActive: true,
      bestseller: raw?.bestseller ?? false,
      trending: raw?.trending ?? false,
      details: raw?.details || {},
    });

    const variants = SIZES.map((size) => {
      const variantId = new Types.ObjectId();

      return {
        _id: variantId,
        productId: product._id,
        sellerId: product.sellerId,

        sku: `${product._id}-${size}`,

        attributes: { size },

        price: Math.floor(Math.random() * 1000) + 299,
        compareAtPrice: Math.floor(Math.random() * 1500) + 1200,

        images: product.images,
        isActive: true,

        inventory: {
          variantId,
          stock: Math.floor(Math.random() * 30) + 5,
          reserved: 0,
          sold: Math.floor(Math.random() * 10),
          lowStockThreshold: 5,
        },
      };
    });

    const variantDocs = variants.map(({ inventory, ...v }) => v);
    const inventoryDocs = variants.map((v) => v.inventory);

    await ProductVariant.insertMany(variantDocs);
    await Inventory.insertMany(inventoryDocs);

    console.log("✅ Inserted:", product.name);

    return product;
  } catch (err) {
    console.error("❌ Failed product:", raw);
    console.error("🔥 ERROR:", err);
  }
};

mongoose.set("bufferCommands", false);

const run = async () => {
  try {
    await mongoose.connect("mongodb://localhost:27017/server");
    console.log("✅ DB Connected");

    await Promise.all(rawData.map(mapMinimalProduct));

    console.log("🔥 All products inserted");
    process.exit();
  } catch (err) {
    console.error("❌ ERROR:", err);
  }
};

run();
