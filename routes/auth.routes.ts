import express from "express";
import { userLogin } from "../controllers/loginController.js";
import { userRegister } from "../controllers/registerController.js";

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

export default router;
