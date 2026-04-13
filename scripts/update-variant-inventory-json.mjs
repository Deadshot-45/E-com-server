import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const variantsPath = path.join(
  __dirname,
  "..",
  "DB_Insert_Cmd",
  "productVariants.updated.json",
);
const inventoryPath = path.join(
  __dirname,
  "..",
  "DB_Insert_Cmd",
  "inventory.updated.json",
);

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const getId = (value) => {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value.$oid) return value.$oid;
  return value;
};

const variantInput = readJson(variantsPath);
const inventoryInput = readJson(inventoryPath);

const inventoryByVariantId = new Map(
  inventoryInput.map((item) => [getId(item.variantId), item]),
);

const normalizeTimestamp = (value) => value?.$date ?? value ?? undefined;

const updatedInventory = inventoryInput.map((item) => ({
  _id: item._id,
  variantId: getId(item.variantId),
  stock: Number(item.stock ?? 0),
  reserved: Number(item.reserved ?? 0),
  sold: Number(item.sold ?? 0),
  lowStockThreshold: Number(item.lowStockThreshold ?? 5),
  createdAt: normalizeTimestamp(item.createdAt),
  updatedAt: normalizeTimestamp(item.updatedAt),
}));

const updatedVariants = variantInput.map((variant) => {
  const variantId = getId(variant._id);
  const inventory = inventoryByVariantId.get(variantId);
  const attributes = variant.attributes && typeof variant.attributes === "object"
    ? variant.attributes
    : {};

  return {
    _id: variant._id,
    productId: getId(variant.productId),
    sellerId: getId(variant.sellerId),
    sku: variant.sku,
    size:
      typeof variant.size === "string"
        ? variant.size
        : typeof attributes.size === "string"
          ? attributes.size
          : undefined,
    color:
      typeof variant.color === "string"
        ? variant.color
        : typeof attributes.color === "string"
          ? attributes.color
          : undefined,
    price: Number(variant.price ?? 0),
    compareAtPrice:
      variant.compareAtPrice !== undefined
        ? Number(variant.compareAtPrice)
        : undefined,
    stock: Number(variant.stock ?? inventory?.stock ?? 0),
    lowStockThreshold: Number(variant.lowStockThreshold ?? inventory?.lowStockThreshold ?? 5),
    isActive: variant.isActive ?? true,
    createdAt: normalizeTimestamp(variant.createdAt),
    updatedAt: normalizeTimestamp(variant.updatedAt),
  };
});

fs.writeFileSync(variantsPath, `${JSON.stringify(updatedVariants, null, 2)}\n`);
fs.writeFileSync(inventoryPath, `${JSON.stringify(updatedInventory, null, 2)}\n`);
