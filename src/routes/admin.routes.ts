import { Router } from "express";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
import {
  adminLogin,
  getDashboardOverview,
  getAllOrders,
  createUser,
  getAllUsers,
  getAllProducts,
} from "../controllers/admin.controller.js";

const router = Router();

// Public routes
router.post("/login", adminLogin);

// Admin-only routes (protected)
router.use(protect, restrictTo("admin"));

router.get("/dashboard/overview", getDashboardOverview);
router.get("/products/all", getAllProducts);
router.get("/orders/all", getAllOrders);
router.get("/users/all", getAllUsers);
router.post("/users", createUser);

export default router;
