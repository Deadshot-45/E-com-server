import { Request, Response } from "express";
import mongoose from "mongoose";
import { Cart } from "../models/Cart.js";
import { Inventory } from "../models/Inventory.js";
import { Order } from "../models/Order.js";
import { Payment } from "../models/Payment.js";
import { Product } from "../models/Product.js";
import { ProductVariant } from "../models/ProductVariant.js";
import { getRazorpay } from "../config/razorpay.js";
import { withTransaction } from "../utils/transaction.js";

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
 *     responses:
 *       201:
 *         description: Checkout successful
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
export const checkout = async (req: Request, res: Response) => {
  try {
    const result = await withTransaction(async (session) => {
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
      const cart = await Cart.findOne({ userId }).session(session || null);

      if (!cart || cart.items.length === 0) {
        throw new Error("Cart is empty");
      }

      let totalAmount = 0;
      let totalItems = 0;
      const orderItems: any[] = [];

      // 2️⃣ Validate + Lock inventory
      for (const item of cart.items) {
        const variant = await ProductVariant.findById(item.variantId).session(
          session || null,
        );

        if (!variant) {
          throw new Error(`Variant not found: ${item.variantId}`);
        }

        const product = await Product.findById(variant.productId).session(
          session || null,
        );

        if (!product || !product.isActive) {
          throw new Error(`Product not active: ${product?.name}`);
        }

        const inv = await Inventory.findOne({
          variantId: item.variantId,
        }).session(session || null);

        if (!inv || inv.stock < item.quantity) {
          throw new Error(`Insufficient stock for item: ${product.name}`);
        }

        // 3️⃣ Reserve stock
        inv.stock -= item.quantity;
        inv.reserved += item.quantity;
        await inv.save({ session });

        totalAmount += variant.price * item.quantity;
        totalItems += item.quantity;

        // Snapshot checkout fields: name and sellerId
        orderItems.push({
          productId: variant.productId,
          variantId: item.variantId,
          sellerId: variant.sellerId || product.sellerId,
          name: product.name,
          quantity: item.quantity,
          price: variant.price,
          attributes: variant.attributes,
        });
      }

      // 4️⃣ Create Order
      const order = new Order({
        userId,
        items: orderItems,
        totalAmount,
        totalItems,
        paymentMethod,
        paymentStatus: "pending",
        status: "pending",
        address,
      });
      await order.save(session ? { session } : undefined);

      // 5️⃣ Handle Online Payment Flow
      if (paymentMethod === "online") {
        const razorpay = getRazorpay();
        const rpOrder = await razorpay.orders.create({
          amount: Math.round(totalAmount * 100),
          currency: "INR",
          receipt: `rcpt_${order._id}`,
        });

        // No need to save razorpayOrderId directly on Order doc as it's saved in Payment
        // instead, update payment model directly below

        const payment = new Payment({
          orderId: order._id,
          userId,
          razorpayOrderId: rpOrder.id,
          method: "online",
          status: "pending",
          amount: Math.round(totalAmount * 100),
          currency: "INR",
        });
        await payment.save(session ? { session } : undefined);

        // Clear Cart
        cart.items = [];
        cart.totalAmount = 0;
        cart.totalItems = 0;
        await cart.save({ session });

        return {
          success: true,
          message: "Checkout successful (online payment initialized)",
          data: {
            order,
            razorpayOrder: rpOrder,
          },
          statusCode: 201,
        };
      }

      // 6️⃣ Handle COD Flow
      const payment = new Payment({
        orderId: order._id,
        userId,
        razorpayOrderId: `cod_${order._id}`,
        method: "cod",
        status: "pending",
        amount: Math.round(totalAmount * 100),
        currency: "INR",
      });
      await payment.save(session ? { session } : undefined);

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

      return {
        success: true,
        message: "Order placed successfully (COD)",
        data: order,
        statusCode: 201,
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
      message: error.message || "Checkout failed",
    });
  }
};
