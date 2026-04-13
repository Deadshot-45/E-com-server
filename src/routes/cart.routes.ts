import express from "express";
import {
  addToCart,
  decrementFromCart,
  getCart,
  removeFromCart,
} from "../controllers/cartController.controller.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /api/cartController/getCart:
 *   get:
 *     summary: Get logged-in user's shopping cart
 *     tags: [cartController]
 *     security:
 *       - bearerAuth: []
 *     description: Retrieve all items in the authenticated user's cart. The user ID is retrieved from the JWT token.
 *     responses:
 *       200:
 *         description: Successfully retrieved the user's cart.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 cart:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       price:
 *                         type: number
 *                       image:
 *                         type: string
 *                       size:
 *                         type: string
 *                       quantity:
 *                         type: number
 *                       sellerId:
 *                         type: string
 *                       sellerName:
 *                         type: string
 *       401:
 *         description: Not authenticated.
 *       404:
 *         description: Cart not found.
 */

router.get("/getCart", protect, getCart);

/**
 * @swagger
 * /api/cartController/addToCart:
 *   post:
 *     summary: Add product item to user's cart
 *     tags: [cartController]
 *     security:
 *       - bearerAuth: []
 *     description: Adds an item to the authenticated user's cart. If a cart doesn't exist for the user, it will be created. The user ID is retrieved from the JWT token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - sellerId
 *               - size
 *               - quantity
 *               - priceSnapshot
 *             properties:
 *               productId:
 *                 type: string
 *                 description: The ID of the product.
 *               sellerId:
 *                 type: string
 *                 description: The ID of the seller.
 *               size:
 *                 type: string
 *                 description: The selected size variant.
 *               quantity:
 *                 type: number
 *                 description: The quantity to add.
 *               priceSnapshot:
 *                 type: number
 *                 description: Price at addition.
 *     responses:
 *       201:
 *         description: Item added successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 cart:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     userId:
 *                       type: string
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           productId:
 *                             type: string
 *                           sellerId:
 *                             type: string
 *                           size:
 *                             type: string
 *                           quantity:
 *                             type: number
 *                           priceSnapshot:
 *                             type: number
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Not authenticated.
 *       404:
 *         description: Cart not found.
 */

router.post("/addToCart", protect, addToCart);

/**
 * @swagger
 * /api/cartController/removeFromCart:
 *   post:
 *     summary: Remove item completely from cart
 *     tags: [cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - variantId
 *             properties:
 *               variantId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Item removed successfully
 */
router.post("/removeFromCart", protect, removeFromCart);

/**
 * @swagger
 * /api/cartController/decrementFromCart:
 *   post:
 *     summary: Decrease quantity of cart item
 *     tags: [cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - variantId
 *             properties:
 *               variantId:
 *                 type: string
 *               quantity:
 *                 type: number
 *     responses:
 *       200:
 *         description: Cart updated successfully
 */
router.post("/decrementFromCart", protect, decrementFromCart);

export default router;
