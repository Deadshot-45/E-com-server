import { Router } from "express";
import {
  getSellerDashboard,
} from "../controllers/dashboard.controller.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = Router();

/**
 * @swagger
 * /dashboard/seller:
 *   get:
 *     summary: Get seller dashboard
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Seller dashboard data
 */

router.get("/seller", protect, restrictTo("seller"), getSellerDashboard);

export default router;
