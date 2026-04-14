import { Router } from "express";
import {
  createProduct,
  getProducts,
  getProductById,
} from "../controllers/product.controller.js";

const router = Router();

router.post("/create", createProduct);
router.get("/getAll", getProducts);
router.get("/getById/:id", getProductById);

export default router;