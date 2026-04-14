import { Router } from "express";
import {
  getDashboardOverview,
  getSellerDashboard,
} from "../controllers/dashboard.controller.js";

const router = Router();

/**
 * @swagger
 * /dashboard/overview:
 *   get:
 *     summary: Get admin dashboard overview
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *     responses:
 *       200:
 *         description: Dashboard data
 */

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

router.get("/overview", getDashboardOverview);
router.get("/seller", getSellerDashboard);

export default router;
