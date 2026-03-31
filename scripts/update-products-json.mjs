import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const targetPath = path.join(__dirname, "..", "DB_Insert_Cmd", "products.json");

const raw = fs.readFileSync(targetPath, "utf8");
const products = JSON.parse(raw);

const updated = products.map((product) => ({
  ...product,
  bestseller: product.bestseller ?? false,
  trending: product.trending ?? false,
  details: product.details ?? {},
}));

fs.writeFileSync(targetPath, `${JSON.stringify(updated, null, 2)}\n`);
