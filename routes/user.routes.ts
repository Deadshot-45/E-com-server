import express from "express";
import { userLogin } from "../controllers/loginController.js";
import { userRegister } from "../controllers/registerController.js";
import { sendOtpHandler } from "../controllers/otpController.js";
import User from "../models/User.js";

const router = (express as any).Router();

/**
 * @swagger
 * /api/users/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Users]
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
 * /api/users/login:
 *   post:
 *     summary: Authenticate a user and create a session
 *     tags: [Users]
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
 * /api/users/send-otp:
 *   post:
 *     summary: Request a verification OTP
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Email address to receive the OTP
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Missing identifier
 *       429:
 *         description: Rate limit exceeded (wait before requesting another)
 */
router.post("/send-otp", sendOtpHandler);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get a user by ID
 *     tags: [Users]
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
router.get("/:id", async (req: any, res: any) => {
  const user = await User.findById(req.params.id);
  res.json(user);
});

export default router;
