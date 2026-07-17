import express from "express";
import {
  forgotPassword,
  userLogin,
} from "../controllers/loginController.controller.js";
import { userRegister } from "../controllers/registerController.controller.js";
import { sendOtpHandler } from "../controllers/otpController.controller.js";
import { protect } from "../middleware/authMiddleware.js";
import { changePassword } from "../controllers/authController.controller.js";

const router = express.Router();

/**
 * @swagger
 * /api/authcontroller/register:
 *   post:
 *     summary: Register a new user
 *     tags: [authController]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - password
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error or user already exists
 */
router.post("/register", userRegister);

/**
 * @swagger
 * /api/authController/login:
 *   post:
 *     summary: Authenticate a user and create a session
 *     tags: [authController]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *               - password
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Email or phone number
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Missing fields or invalid password format
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", userLogin);

/**
 * @swagger
 * /api/authController/forgot-password:
 *   post:
 *     summary: Initiate password reset process
 *     tags: [authController]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email/phone
 *             properties:
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset instructions sent
 *       400:
 *         description: Missing email field
 *       404:
 *         description: User not found
 */
router.post("/forgot-password", forgotPassword, sendOtpHandler);

/**
 * @swagger
 * /api/authController/reset-password:
 *   post:
 *     summary: Reset user password
 *     tags: [authController]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Validation error or passwords do not match
 *       401:
 *         description: Unauthorized or invalid token
 *       404:
 *         description: User not found
 *
 */
router.post("/reset-password", protect, changePassword);

export default router;
