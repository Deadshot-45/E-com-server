import { Request, Response } from "express";
import { Order } from "../models/Order.js";
import { Inventory } from "../models/Inventory.js";
import { Payment } from "../models/Payment.js";
import mongoose from "mongoose";
import { withTransaction } from "../utils/transaction.js";

// ─────────────────────────────────────────────────────────────────────────────
// 1️⃣  GET MY ORDERS  →  Paginated list of user's orders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Get logged-in user's orders
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, shipped, delivered, cancelled]
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Order'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
 */
export const getMyOrders = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit as string) || 10),
    );
    const skip = (page - 1) * limit;

    // Optional status filter
    const filter: any = { userId };
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: "Orders retrieved successfully",
      data: orders,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch orders",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2️⃣  GET ORDER BY ID  →  Single order with payment info
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/orders/{orderId}:
 *   get:
 *     summary: Get order details by ID
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order details retrieved
 *       404:
 *         description: Order not found
 */
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const { orderId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (
      typeof orderId !== "string" ||
      !mongoose.Types.ObjectId.isValid(orderId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await Order.findOne({ _id: orderId, userId }).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Get associated payment
    const payment = await Payment.findOne({ orderId: order._id })
      .select("method status razorpayPaymentId paidAt amount currency")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Order retrieved successfully",
      data: {
        ...order,
        payment: payment || null,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch order",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3️⃣  CANCEL ORDER  →  Release inventory + update status
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/orders/{orderId}/cancel:
 *   post:
 *     summary: Cancel an order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 *       400:
 *         description: Order cannot be cancelled
 *       404:
 *         description: Order not found
 */
export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const result = await withTransaction(async (session) => {
      const userId = req.user?._id;
      const { orderId } = req.params;

      if (!userId) {
        throw new Error("User not authenticated");
      }

      const order = await Order.findOne({ _id: orderId, userId }).session(
        session || null,
      );

      if (!order) {
        throw new Error("Order not found");
      }

      // Can only cancel pending or confirmed orders
      if (!["pending", "confirmed"].includes(order.status)) {
        throw new Error(
          `Cannot cancel order with status '${order.status}'. Only pending or confirmed orders can be cancelled.`,
        );
      }

      // Release reserved inventory
      for (const item of order.items) {
        const updateOp: any = {};

        if (order.status === "pending") {
          // Online payment not yet completed → release reservation
          updateOp.$inc = { reserved: -item.quantity };
        } else if (order.status === "confirmed") {
          // COD or paid order → restore stock
          updateOp.$inc = { stock: item.quantity, sold: -item.quantity };
        }

        if (Object.keys(updateOp).length > 0) {
          await Inventory.updateOne({ variantId: item.variantId }, updateOp, {
            session,
          });
        }
      }

      // Update order status
      order.status = "cancelled";
      order.paymentStatus =
        order.paymentStatus === "paid" ? "refunded" : "failed";
      await order.save({ session });

      // Update payment status
      await Payment.updateOne(
        { orderId: order._id },
        {
          status: order.paymentStatus === "refunded" ? "refunded" : "failed",
          ...(order.paymentStatus === "refunded"
            ? { refundedAt: new Date() }
            : { failedAt: new Date() }),
        },
        { session },
      );

      return {
        success: true,
        message: "Order cancelled successfully",
        data: order,
        statusCode: 200,
      };
    });

    return res.status(result.statusCode || 200).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to cancel order",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4️⃣  UPDATE ORDER STATUS  →  Admin only
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/orders/{orderId}/status:
 *   patch:
 *     summary: Update order status (Admin only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [confirmed, shipped, delivered, cancelled]
 *     responses:
 *       200:
 *         description: Order status updated
 *       400:
 *         description: Invalid status transition
 *       404:
 *         description: Order not found
 */
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (
      !status ||
      !["confirmed", "shipped", "delivered", "cancelled"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (req.user?.role === "seller") {
      const isSellersOrder = order.items.some((item: any) => item.sellerId?.toString() === req.user?._id.toString());
      if (!isSellersOrder) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to update this order.",
        });
      }
    }

    // Define valid transitions
    const validTransitions: Record<string, string[]> = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["shipped", "cancelled"],
      shipped: ["delivered"],
      delivered: [],
      cancelled: [],
    };

    if (!validTransitions[order.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from '${order.status}' to '${status}'`,
      });
    }

    order.status = status;

    // Auto-update paymentStatus for COD on delivery
    if (status === "delivered" && order.paymentMethod === "cod") {
      order.paymentStatus = "paid";

      await Payment.updateOne(
        { orderId: order._id },
        { status: "paid", paidAt: new Date() },
      );
    }

    await order.save();

    return res.status(200).json({
      success: true,
      message: `Order status updated to '${status}'`,
      data: order,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update order status",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 5️⃣  GET ALL ORDERS  →  Admin only (with filters)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/orders/admin/all:
 *   get:
 *     summary: Get all orders (Admin only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, shipped, delivered, cancelled]
 *       - in: query
 *         name: paymentStatus
 *         schema:
 *           type: string
 *           enum: [pending, paid, failed, refunded]
 *     responses:
 *       200:
 *         description: All orders retrieved
 */
export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit as string) || 20),
    );
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;

    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: "Orders retrieved successfully",
      data: orders,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch orders",
    });
  }
};

export const getSellerOrders = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?._id;
    if (!sellerId) {
      return res.status(401).json({
        success: false,
        message: "Seller not authenticated",
      });
    }

    const orders = await Order.find({ "items.sellerId": sellerId }).sort({ createdAt: -1 }).populate("userId", "email").lean();

    const mappedOrders = orders.map((o: any) => {
      const sellerItems = o.items.filter((item: any) => item.sellerId?.toString() === sellerId.toString());
      const sellerAmount = sellerItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
      const totalItems = sellerItems.reduce((sum: number, item: any) => sum + item.quantity, 0);

      return {
        id: o._id,
        customer: o.address?.fullName || o.userId?.email || "Guest Customer",
        email: o.userId?.email || "",
        date: o.placedAt || o.createdAt,
        amount: sellerAmount,
        status: o.status,
        items: totalItems,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Seller orders retrieved successfully",
      data: mappedOrders,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch seller orders",
    });
  }
};

export const getUserOrders = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    console.log("order fetched")

    const orders = await Order.find({ userId }).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      message: "User orders retrieved successfully",
      data: orders,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch user orders",
    });
  }
};
