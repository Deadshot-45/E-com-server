import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const productsPath = path.join(__dirname, "..", "DB_Insert_Cmd", "products.json");
const inventoryPath = path.join(__dirname, "..", "DB_Insert_Cmd", "inventory.json");

const raw = fs.readFileSync(productsPath, "utf8");
const products = JSON.parse(raw);

const defaultSizes = ["S", "M", "L", "XL"];
const productIdPrefix = "67dfa578452634da4759aa";
const inventoryIdPrefix = "67dfa578452634da4759bb";

const padId = (prefix, index) => `${prefix}${String(index + 1).padStart(2, "0")}`;

const normalizeInventoryItems = (inventory, sizes) => {
  if (Array.isArray(inventory)) {
    const normalized = [];

    for (const entry of inventory) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      const record = entry;
      const size = typeof record.size === "string" ? record.size.trim() : "";
      const quantity = Number(record.quantity);
      const updatedAt = record.updatedAt ?? new Date().toISOString();

      if (!size || !Number.isFinite(quantity)) {
        continue;
      }

      normalized.push({
        size,
        quantity,
        updatedAt,
      });
    }

    return normalized;
  }

  const legacyQuantity =
    inventory && typeof inventory === "object" && !Array.isArray(inventory) && Number.isFinite(Number(inventory.quantity))
      ? Number(inventory.quantity)
      : 0;

  const legacyUpdatedAt =
    inventory && typeof inventory === "object" && !Array.isArray(inventory) && inventory.updatedAt
      ? inventory.updatedAt
      : new Date().toISOString();

  return sizes.map((size) => ({
    size,
    quantity: legacyQuantity,
    updatedAt: legacyUpdatedAt,
  }));
};

const updatedProducts = [];
const inventorySeed = [];

products.forEach((product, index) => {
  const sizes = Array.isArray(product.sizes) && product.sizes.length > 0 ? product.sizes : defaultSizes;
  const inventoryItems = normalizeInventoryItems(product.inventory, sizes);
  const productId = padId(productIdPrefix, index);
  const inventoryId = padId(inventoryIdPrefix, index);

  updatedProducts.push({
    ...product,
    _id: { $oid: productId },
    inventoryId: { $oid: inventoryId },
    sku: product.sku ?? `seed-${String(index + 1).padStart(3, "0")}`,
    sizes,
    bestseller: product.bestseller ?? false,
    trending: product.trending ?? false,
    details: product.details ?? {},
    inventory: undefined,
  });

  inventorySeed.push({
    _id: { $oid: inventoryId },
    productId: { $oid: productId },
    items: inventoryItems,
  });
});

const stripUndefined = (value) => JSON.parse(JSON.stringify(value));

fs.writeFileSync(productsPath, `${JSON.stringify(stripUndefined(updatedProducts), null, 2)}\n`);
fs.writeFileSync(inventoryPath, `${JSON.stringify(inventorySeed, null, 2)}\n`);
