import { Router } from "express";
import {
  createProduct,
  getProducts,
  getProductById,
  getSearchSuggestions,
} from "../controllers/product.controller.js";

const router = Router();

router.post("/create", createProduct);
router.get("/getAll", getProducts);
router.get("/getById/:id", getProductById);
router.get("/search-suggestions", getSearchSuggestions);

export default router;