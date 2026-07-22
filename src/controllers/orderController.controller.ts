import { Request, Response } from "express";
import { Order } from "../models/Order.js";
import { Inventory } from "../models/Inventory.js";
import { Payment } from "../models/Payments.js";
import mongoose from "mongoose";
import { withTransaction } from "../utils/transaction.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  UnauthorizedError,
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  BadGatewayError,
} from "../utils/AppError.js";
import { createCheckoutSession } from "../utils/stripe.js";
import { getRazorpay, getRazorpayKeys } from "../config/razorpay.js";


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
export const getMyOrders = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  if (!userId) throw new UnauthorizedError("User not authenticated");

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
  const skip = (page - 1) * limit;

  const filter: any = { userId };
  if (req.query.status) filter.status = req.query.status;

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
      total, page, limit, totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  });
});


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
export const getOrderById = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { orderId } = req.params;

  if (!userId) throw new UnauthorizedError("User not authenticated");

  if (!mongoose.Types.ObjectId.isValid(orderId as string)) {
    throw new BadRequestError("Invalid order ID");
  }

  const order = await Order.findOne({ _id: orderId, userId }).lean();
  if (!order) throw new NotFoundError("Order not found");

  const payment = await Payment.findOne({ orderId: order._id })
    .select("method status razorpayPaymentId paidAt amount currency")
    .lean();

  return res.status(200).json({
    success: true,
    message: "Order retrieved successfully",
    data: { ...order, payment: payment || null },
  });
});


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
export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  const result = await withTransaction(async (session) => {
    const userId = req.user?._id;
    const { orderId } = req.params;

    if (!userId) throw new UnauthorizedError("User not authenticated");

    const order = await Order.findOne({ _id: orderId, userId }).session(session || null);
    if (!order) throw new NotFoundError("Order not found");

    if (!["pending", "confirmed"].includes(order.status)) {
      throw new BadRequestError(
        `Cannot cancel order with status '${order.status}'. Only pending or confirmed orders can be cancelled.`,
      );
    }

    // Release reserved inventory
    for (const item of order.items) {
      const updateOp: any = {};
      if (order.status === "pending") {
        updateOp.$inc = { reserved: -item.quantity };
      } else if (order.status === "confirmed") {
        updateOp.$inc = { stock: item.quantity, sold: -item.quantity };
      }
      if (Object.keys(updateOp).length > 0) {
        await Inventory.updateOne({ variantId: item.variantId }, updateOp, { session });
      }
    }

    order.status = "cancelled";
    order.paymentStatus = order.paymentStatus === "paid" ? "refunded" : "failed";
    await order.save({ session });

    await Payment.updateOne(
      { orderId: order._id },
      {
        status: order.paymentStatus === "refunded" ? "refunded" : "failed",
        ...(order.paymentStatus === "refunded" ? { refundedAt: new Date() } : { failedAt: new Date() }),
      },
      { session },
    );

    return { success: true, message: "Order cancelled successfully", data: order, statusCode: 200 };
  });

  return res.status(result.statusCode || 200).json({
    success: result.success,
    message: result.message,
    data: result.data,
  });
});


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
export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { status } = req.body;

  const validStatuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
  if (!status || !validStatuses.includes(status)) {
    throw new BadRequestError("Invalid status");
  }

  const order = await Order.findById(orderId);
  if (!order) throw new NotFoundError("Order not found");

  if (req.user?.role === "seller") {
    const isSellersOrder = order.items.some(
      (item: any) => item.sellerId?.toString() === req.user?._id.toString()
    );
    if (!isSellersOrder) {
      throw new ForbiddenError("You do not have permission to update this order.");
    }
  }

  const validTransitions: Record<string, string[]> = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["shipped", "cancelled"],
    shipped: ["delivered"],
    delivered: [],
    cancelled: [],
  };

  if (!validTransitions[order.status]?.includes(status)) {
    throw new BadRequestError(`Cannot transition from '${order.status}' to '${status}'`);
  }

  order.status = status;

  if (status === "delivered" && order.paymentMethod === "cod") {
    order.paymentStatus = "paid";
    await Payment.updateOne({ orderId: order._id }, { status: "paid", paidAt: new Date() });
  }

  await order.save();

  return res.status(200).json({
    success: true,
    message: `Order status updated to '${status}'`,
    data: order,
  });
});


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
export const getAllOrders = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
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
      total, page, limit, totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  });
});


export const getSellerOrders = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = req.user?._id;
  if (!sellerId) throw new UnauthorizedError("Seller not authenticated");

  const orders = await Order.find({ "items.sellerId": sellerId })
    .sort({ createdAt: -1 })
    .populate("userId", "email")
    .lean();

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
});


export const getUserOrders = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  if (!userId) throw new UnauthorizedError("User not authenticated");

  const orders = await Order.find({ userId }).sort({ createdAt: -1 }).lean();

  return res.status(200).json({
    success: true,
    message: "User orders retrieved successfully",
    data: orders,
  });
});

/**
 * @swagger
 * /api/orders/retry-payment:
 *   post:
 *     summary: Retry payment for an existing unpaid or failed order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderId:
 *                 type: string
 *               paymentMethod:
 *                 type: string
 *                 enum: [card, upi, cod, online]
 *     responses:
 *       200:
 *         description: Payment gateway session re-created or status updated to COD
 *       400:
 *         description: Order already paid or invalid request
 *       404:
 *         description: Order not found
 */
export const retryPayment = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  if (!userId) throw new UnauthorizedError("User not authenticated");

  const orderId = req.body?.orderId || req.params?.orderId;
  if (!orderId) {
    throw new BadRequestError("orderId is required");
  }

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new BadRequestError("Invalid orderId format");
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new NotFoundError("Order not found");
  }

  // Security check: order must belong to user unless admin
  if (order.userId.toString() !== userId.toString() && req.user?.role !== "admin") {
    throw new ForbiddenError("You do not have permission to retry payment for this order");
  }

  // Check if order is already paid
  if (order.paymentStatus === "paid") {
    throw new BadRequestError("This order is already paid");
  }

  const selectedPaymentMethod = req.body?.paymentMethod || order.paymentMethod || "card";
  order.paymentMethod = selectedPaymentMethod;

  // If order was cancelled due to payment failure, reset status to pending or confirmed
  if (order.status === "cancelled" || order.paymentStatus === "failed") {
    order.status = selectedPaymentMethod === "cod" ? "confirmed" : "pending";
    order.paymentStatus = "unpaid";
  }

  await order.save();

  const responseData: {
    success: boolean;
    message: string;
    data: any;
    url?: string;
    razorpay?: {
      orderId: string;
      amount: number;
      currency: string;
      key: string;
    };
  } = {
    success: true,
    message: "Payment retry initialized",
    data: order,
  };

  const calculatedShippingFee = order.shippingFee || 0;
  const calculatedTax = order.tax || 0;
  const discount = order.discount || 0;

  if (selectedPaymentMethod === "cod") {
    order.status = "confirmed";
    order.paymentStatus = "unpaid";
    await order.save();

    // Create or update Payment record
    await Payment.findOneAndUpdate(
      { orderId: order._id },
      {
        $set: {
          userId,
          razorpayOrderId: `cod_${order._id}`,
          method: "cod",
          status: "pending",
          amount: Math.round(order.totalAmount * 100),
          currency: "INR",
        },
      },
      { upsert: true, new: true }
    );

    responseData.message = "Order payment method changed to COD successfully";
  } else if (selectedPaymentMethod === "card") {
    // Re-create Stripe checkout session
    const stripeSession = await createCheckoutSession({
      product: order.items,
      orderId: order._id.toString(),
      shippingFee: calculatedShippingFee,
      tax: calculatedTax,
      discount: discount,
    });

    if (!stripeSession || !stripeSession.url) {
      throw new BadGatewayError("Failed to create Stripe checkout session");
    }

    await Payment.findOneAndUpdate(
      { orderId: order._id },
      {
        $set: {
          userId,
          razorpayOrderId: `stripe_${stripeSession.id}`,
          method: "online",
          status: "created",
          amount: Math.round(order.totalAmount * 100),
          currency: "INR",
        },
      },
      { upsert: true, new: true }
    );

    responseData.message = "Stripe checkout session created";
    responseData.url = stripeSession.url;
  } else {
    // Razorpay integration ("upi" or "online")
    let razorpayOrderId: string;
    let razorpayAmount: number = Math.round(order.totalAmount * 100);
    let razorpayCurrency: string = "INR";
    const { keyId } = getRazorpayKeys();

    try {
      const razorpayInstance = getRazorpay();
      const razorpayOrder = await razorpayInstance.orders.create({
        amount: razorpayAmount,
        currency: razorpayCurrency,
        receipt: order._id.toString(),
        notes: {
          orderId: order._id.toString(),
          userId: userId.toString(),
        },
      });

      if (!razorpayOrder || !razorpayOrder.id) {
        throw new BadGatewayError("Razorpay API returned empty order ID");
      }

      razorpayOrderId = razorpayOrder.id;
      razorpayAmount = Number(razorpayOrder.amount);
      razorpayCurrency = razorpayOrder.currency;
    } catch (rzpErr: any) {
      if (rzpErr?.statusCode) throw rzpErr;
      throw new BadGatewayError(
        `Razorpay order creation failed: ${rzpErr?.message || rzpErr?.error?.description || "Invalid credentials"}`
      );
    }

    await Payment.findOneAndUpdate(
      { orderId: order._id },
      {
        $set: {
          userId,
          razorpayOrderId: razorpayOrderId,
          method: "online",
          status: "created",
          amount: razorpayAmount,
          currency: razorpayCurrency,
        },
      },
      { upsert: true, new: true }
    );

    responseData.message = "Razorpay payment order created";
    responseData.razorpay = {
      orderId: razorpayOrderId,
      amount: razorpayAmount,
      currency: razorpayCurrency,
      key: keyId,
    };
  }

  return res.status(200).json(responseData);
});


