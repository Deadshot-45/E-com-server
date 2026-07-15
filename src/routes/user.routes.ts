import express, { Request, Response, NextFunction } from "express";
import User from "../models/User.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * /api/userController/admin/all:
 *   get:
 *     summary: Get all users with profiles and order counts (Admin only)
 *     tags: [userController]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 */
router.get("/admin/all", protect, restrictTo("admin"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pipeline = [
      {
        $lookup: {
          from: "customers",
          localField: "_id",
          foreignField: "userId",
          as: "customerProfile",
        },
      },
      {
        $lookup: {
          from: "sellers",
          localField: "_id",
          foreignField: "ownerUserId",
          as: "sellerProfile",
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "_id",
          foreignField: "userId",
          as: "userOrders",
        },
      },
      {
        $project: {
          _id: 1,
          email: 1,
          role: 1,
          isActive: 1,
          createdAt: 1,
          fullName: {
            $ifNull: [
              { $arrayElemAt: ["$customerProfile.fullName", 0] },
              { $ifNull: [
                { $arrayElemAt: ["$sellerProfile.name", 0] },
                "$email"
              ]}
            ]
          },
          ordersCount: { $size: "$userOrders" },
        },
      },
      {
        $sort: { createdAt: -1 }
      }
    ];

    const users = await User.aggregate(pipeline as any);
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

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
