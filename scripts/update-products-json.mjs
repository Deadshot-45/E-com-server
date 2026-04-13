import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const productsPath = path.join(__dirname, "..", "DB_Insert_Cmd", "products.json");
const updatedProductsPath = path.join(
  __dirname,
  "..",
  "DB_Insert_Cmd",
  "products.updated.json",
);
const inventoryPath = path.join(__dirname, "..", "DB_Insert_Cmd", "inventory.json");

const raw = fs.readFileSync(productsPath, "utf8");
const products = JSON.parse(raw);
const inventoryRaw = fs.readFileSync(inventoryPath, "utf8");
const inventories = JSON.parse(inventoryRaw);

const defaultSizes = ["S", "M", "L", "XL"];

const getId = (value) => {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value.$oid) return value.$oid;
  return undefined;
};

const inventoryByProductId = new Map(
  inventories.map((inventory) => [getId(inventory.productId), inventory]),
);

const normalizeImages = (images) => {
  if (!Array.isArray(images)) return [];

  return images
    .map((image, index) => {
      if (typeof image === "string") {
        return { url: image, isPrimary: index === 0 };
      }

      if (image && typeof image === "object" && typeof image.url === "string") {
        return {
          url: image.url,
          isPrimary: Boolean(image.isPrimary ?? index === 0),
        };
      }

      return null;
    })
    .filter(Boolean);
};

const normalizeInventoryItems = (inventoryDoc, sizes) => {
  if (inventoryDoc && Array.isArray(inventoryDoc.items)) {
    return inventoryDoc.items
      .map((item) => ({
        size: typeof item.size === "string" ? item.size.trim() : "",
        quantity: Number(item.quantity ?? item.stock ?? 0),
        updatedAt: item.updatedAt?.$date ?? item.updatedAt ?? new Date().toISOString(),
      }))
      .filter((item) => item.size);
  }

  return sizes.map((size) => ({
    size,
    quantity: 0,
    updatedAt: new Date().toISOString(),
  }));
};

const normalizeVariantImages = (images) =>
  Array.isArray(images) ? images.filter((image) => typeof image === "string") : [];

const updatedProducts = products.map((product, index) => {
  const productId = getId(product._id);
  const inventoryDoc = inventoryByProductId.get(productId);
  const sizes =
    Array.isArray(product.sizes) && product.sizes.length > 0
      ? product.sizes
      : defaultSizes;
  const inventoryItems = normalizeInventoryItems(inventoryDoc, sizes);
  const images = normalizeImages(product.images);
  const baseSku = product.sku ?? `seed-${String(index + 1).padStart(3, "0")}`;
  const basePrice = Number(product.price ?? 0);
  const compareAtPrice = Number(product.compareAtPrice ?? 0);

  return {
    _id: product._id ?? { $oid: productId },
    sellerId: getId(product.sellerId),
    name: product.name,
    description:
      product.description ??
      "A lightweight cotton product from the seeded catalog.",
    categoryIds: Array.isArray(product.categoryIds)
      ? product.categoryIds.map(getId).filter(Boolean)
      : [],
    subCategoryId: getId(product.subCategoryId),
    images,
    variants: inventoryItems.map((item) => ({
      sku: `${baseSku}-${String(item.size).toLowerCase()}`,
      size: item.size,
      price: basePrice,
      compareAtPrice: compareAtPrice || undefined,
      images: normalizeVariantImages(images.map((image) => image.url)),
      stock: item.quantity,
      lowStockThreshold: Number(product.lowStockThreshold ?? 5),
      isActive: true,
    })),
    bestseller: Boolean(product.bestseller),
    trending: Boolean(product.trending),
    details: product.details ?? {},
    isActive: product.isActive ?? true,
  };
});

fs.writeFileSync(updatedProductsPath, `${JSON.stringify(updatedProducts, null, 2)}\n`);
