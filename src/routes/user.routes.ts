import express, { Request, Response, NextFunction } from "express";
import User from "../models/User.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
import { getUserDetails } from "../controllers/userController.controller.js";

const router = express.Router();



/**
 * @swagger
 * /api/userController/{id}:
 *   get:
 *     summary: Get a user by ID
 *     tags: [userController]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID
 *     responses:
 *       200:
 *         description: User found
 *       404:
 *         description: User not found
 */

router.get("/:id", protect, getUserDetails);
export default router;
