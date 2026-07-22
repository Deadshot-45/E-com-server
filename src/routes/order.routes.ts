import express from "express";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
import { checkout } from "../controllers/checkoutController.controller.js";
import {
  getMyOrders,
  getOrderById,
  cancelOrder,
  getSellerOrders,
  getUserOrders,
  retryPayment,
} from "../controllers/orderController.controller.js";
import { verifyPayment } from "../controllers/paymentController.controller.js";

const router = express.Router();

// ─── Checkout ────────────────────────────────────────────────────────────────
router.post("/checkout-session", protect, checkout);
router.post("/confirm", protect, verifyPayment);
router.post("/retry-payment", protect, retryPayment);
router.post("/:orderId/retry-payment", protect, retryPayment);

// ─── Customer Routes ─────────────────────────────────────────────────────────
router.get("/", protect, getMyOrders);
router.get("/:orderId", protect, getOrderById);
router.post("/:orderId/cancel", protect, cancelOrder);
router.get("/my-orders", protect, getUserOrders);

// ─── Seller Routes ───────────────────────────────────────────────────────────
router.get("/seller/all", protect, restrictTo("seller"), getSellerOrders);

export default router;
