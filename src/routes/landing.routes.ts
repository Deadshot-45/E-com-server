import { Router } from "express";
import { getLandingPage } from "../controllers/landing.controller";

const router = Router();

/**
 * @swagger
 * /landing:
 *   get:
 *     summary: Get landing page data
 *     tags: [Landing]
 *     responses:
 *       200:
 *         description: Landing page data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     banners:
 *                       type: array
 *                       items:
 *                         type: object
 *                     categories:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Product'
 *                     sections:
 *                       type: object
 *                       properties:
 *                         newArrivals:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Product'
 *                         trending:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Product'
 *                         bestsellers:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Product'
 *                         featured:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Product'
 */
router.get("/", getLandingPage);

export default router;
