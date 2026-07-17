import { Router } from "express";
import {
  createProduct,
  getProducts,
  getProductById,
  getSearchSuggestions,
  uploadImage,
  deleteProduct,
  toggleProductStatus,
} from "../controllers/product.controller.js";
import { sellerAuthMiddleware } from "../middleware/sellerAuthMiddleware.js";
import uploadFile from "../utils/multer.js";

const router = Router();
let upload = uploadFile();

router.post("/create", sellerAuthMiddleware, createProduct);
router.get("/getAll", getProducts);

router.post("/upload", sellerAuthMiddleware, upload.single("file"), uploadImage);
router.get("/getById/:id", getProductById);
router.get("/search-suggestions", getSearchSuggestions);

/**
 * PATCH /api/products/:id/status
 * Toggle product active/draft state.
 * Draft products are invisible to customers (isActive: false).
 * Body: { isActive: boolean }  — or omit body to auto-toggle
 */
router.delete("/:id", sellerAuthMiddleware, deleteProduct);
router.patch("/:id/status",sellerAuthMiddleware, toggleProductStatus);

export default router;