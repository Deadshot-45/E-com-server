import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourcePath = path.join(
  __dirname,
  "..",
  "DB_Insert_Cmd",
  "inventory.updated.json",
);
const targetPath = path.join(__dirname, "..", "DB_Insert_Cmd", "inventory.json");

const inventory = JSON.parse(fs.readFileSync(sourcePath, "utf8"));

const normalized = inventory.map((item) => ({
  _id: item._id,
  variantId: item.variantId,
  stock: Number(item.stock ?? 0),
  reserved: Number(item.reserved ?? 0),
  sold: Number(item.sold ?? 0),
  lowStockThreshold: Number(item.lowStockThreshold ?? 5),
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
}));

fs.writeFileSync(targetPath, `${JSON.stringify(normalized, null, 2)}\n`);
