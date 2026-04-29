import express from "express";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
import { checkout } from "../controllers/checkoutController.controller.js";
import {
  getMyOrders,
  getOrderById,
  cancelOrder,
  updateOrderStatus,
  getAllOrders,
} from "../controllers/orderController.controller.js";

const router = express.Router();

// ─── Checkout ────────────────────────────────────────────────────────────────
router.post("/checkout", protect, checkout);

// ─── Customer Routes ─────────────────────────────────────────────────────────
router.get("/", protect, getMyOrders);
router.get("/:orderId", protect, getOrderById);
router.post("/:orderId/cancel", protect, cancelOrder);

// ─── Admin Routes ────────────────────────────────────────────────────────────
router.get("/admin/all", protect, restrictTo("admin"), getAllOrders);
router.patch(
  "/:orderId/status",
  protect,
  restrictTo("admin"),
  updateOrderStatus,
);

export default router;
