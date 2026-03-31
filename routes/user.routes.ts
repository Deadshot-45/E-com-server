import express, { Request, Response } from "express";
import User from "../models/User.js";

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

router.get("/:id", async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  res.json(user);
});

export default router;
