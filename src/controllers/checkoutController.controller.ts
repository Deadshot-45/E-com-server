import { Request, Response } from "express";
import mongoose from "mongoose";
import { Cart } from "../models/Cart.js";
import { Inventory } from "../models/Inventory.js";
import { Order } from "../models/Order.js";
import { Payment } from "../models/Payment.js";
import { ProductVariant } from "../models/ProductVariant.js";
import { getRazorpay } from "../config/razorpay.js";

// ─────────────────────────────────────────────────────────────────────────────
// 1️⃣  CHECKOUT  →  Cart ➜ Order + Razorpay order (for online) or direct COD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/checkout:
 *   post:
 *     summary: Checkout cart and create order
 *     tags: [Checkout]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentMethod
 *               - address
 *             properties:
 *               paymentMethod:
 *                 type: string
 *                 enum: [cod, online]
 *                 example: online
 *               address:
 *                 type: object
 *                 required:
 *                   - fullName
 *                   - phone
 *                   - addressLine
 *                   - city
 *                   - state
 *                   - postalCode
 *                   - country
 *                 properties:
 *                   fullName:
 *                     type: string
 *                     example: John Doe
 *                   phone:
 *                     type: string
 *                     example: "9876543210"
 *                   addressLine:
 *                     type: string
 *                     example: Street 123, Area
 *                   city:
 *                     type: string
 *                     example: Indore
 *                   state:
 *                     type: string
 *                     example: MP
 *                   postalCode:
 *                     type: string
 *                     example: "452001"
 *                   country:
 *                     type: string
 *                     example: India
 *     responses:
 *       201:
 *         description: Order placed / Razorpay order created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       400:
 *         description: Checkout failed
 *       401:
 *         description: Unauthorized
 */
export const checkout = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const userId = req.user?._id;

    if (!userId) {
      throw new Error("User not authenticated");
    }

    const { address, paymentMethod } = req.body;

    if (!address || !paymentMethod) {
      throw new Error("Address and payment method are required");
    }

    if (!["cod", "online"].includes(paymentMethod)) {
      throw new Error("Invalid payment method. Use 'cod' or 'online'");
    }

    // 1️⃣ Get cart
    const cart = await Cart.findOne({ userId }).session(session);

    if (!cart || cart.items.length === 0) {
      throw new Error("Cart is empty");
    }

    let totalAmount = 0;
    let totalItems = 0;
    const orderItems: any[] = [];

    // 2️⃣ Validate + Lock inventory
    for (const item of cart.items) {
      const variant = await ProductVariant.findById(item.variantId).session(
        session,
      );

      if (!variant || !variant.isActive) {
        throw new Error("Variant not available");
      }

      const inventory = await Inventory.findOne({
        variantId: item.variantId,
      }).session(session);

      if (!inventory) {
        throw new Error("Inventory not found");
      }

      const available = inventory.stock - inventory.reserved;

      if (available < item.quantity) {
        throw new Error(`Insufficient stock for ${variant.sku}`);
      }

      // 3️⃣ Reserve stock
      inventory.reserved += item.quantity;
      await inventory.save({ session });

      // 4️⃣ Build order snapshot
      orderItems.push({
        productId: item.productId,
        variantId: item.variantId,
        sku: variant.sku,
        price: variant.price,
        quantity: item.quantity,
        image: variant.images?.[0]?.url,
        attributes: variant.attributes,
      });

      totalAmount += variant.price * item.quantity;
      totalItems += item.quantity;
    }

    // 5️⃣ Create Order
    const [order] = await Order.create(
      [
        {
          userId,
          items: orderItems,
          totalAmount,
          totalItems,
          paymentMethod,
          paymentStatus: "pending",
          status: "pending",
          address,
        },
      ],
      { session },
    );

    // 6️⃣ Handle payment based on method
    if (paymentMethod === "online") {
      // Create Razorpay order
      const razorpayOrder = await getRazorpay().orders.create({
        amount: Math.round(totalAmount * 100), // Razorpay expects paise
        currency: "INR",
        receipt: order._id.toString(),
        notes: {
          orderId: order._id.toString(),
          userId: userId.toString(),
        },
      });

      // Create Payment record
      await Payment.create(
        [
          {
            orderId: order._id,
            userId,
            razorpayOrderId: razorpayOrder.id,
            method: "online",
            status: "created",
            amount: Math.round(totalAmount * 100),
            currency: "INR",
          },
        ],
        { session },
      );

      // 7️⃣ Clear Cart
      cart.items = [];
      cart.totalAmount = 0;
      cart.totalItems = 0;
      await cart.save({ session });

      await session.commitTransaction();
      session.endSession();

      return res.status(201).json({
        success: true,
        message: "Razorpay order created. Complete payment to confirm.",
        data: {
          order: order,
          razorpay: {
            orderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            key: process.env.RAZORPAY_KEY_ID,
          },
        },
      });
    }

    // COD flow — auto-confirm
    // Create Payment record for COD
    await Payment.create(
      [
        {
          orderId: order._id,
          userId,
          razorpayOrderId: `cod_${order._id}`,
          method: "cod",
          status: "pending",
          amount: Math.round(totalAmount * 100),
          currency: "INR",
        },
      ],
      { session },
    );

    order.status = "confirmed";
    await order.save({ session });

    // 7️⃣ Clear Cart
    cart.items = [];
    cart.totalAmount = 0;
    cart.totalItems = 0;
    await cart.save({ session });

    // 8️⃣ Deduct reserved → update sold count for COD
    for (const item of orderItems) {
      await Inventory.updateOne(
        { variantId: item.variantId },
        {
          $inc: {
            reserved: -item.quantity,
            sold: item.quantity,
          },
        },
        { session },
      );
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "Order placed successfully (COD)",
      data: order,
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();

    return res.status(400).json({
      success: false,
      message: error.message || "Checkout failed",
    });
  }
};
