import { Request, Response } from "express";
import mongoose from "mongoose";
import { Cart } from "../models/Cart.js";
import { Inventory } from "../models/Inventory.js";
import { Payment } from "../models/Payment.js";
import { Product } from "../models/Product.js";
import { ProductVariant } from "../models/ProductVariant.js";
import { getRazorpay } from "../config/razorpay.js";
import { withTransaction } from "../utils/transaction.js";
import { Order } from "../models/Order.js";
import { createCheckoutSession } from "../utils/stripe.js";

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

      const { address, paymentMethod, tax, shippingFee, subTotal } = req.body;

      if (!address || !paymentMethod) {
        throw new Error("Address and payment method are required");
      }

      const allowedMethods = ["cod", "online", "card", "upi"];
      if (!allowedMethods.includes(paymentMethod)) {
        throw new Error(`Invalid payment method. Use one of: ${allowedMethods.join(", ")}`);
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
          productId: variant.productId.toString(),
          variantId: item.variantId.toString(),
          sellerId: (variant.sellerId || product.sellerId).toString(),
          name: String(product.name),
          quantity: Number(item.quantity),
          price: Number(variant.price),
          image: String(variant.images[0] || product.images[0] || ""), 
        });
      }

      // Map paymentMethod to match Mongoose Order Schema enum ['card', 'cod', 'upi']
      let mappedMethod: "card" | "cod" | "upi";
      if (paymentMethod === "cod") {
        mappedMethod = "cod";
      } else if (paymentMethod === "upi") {
        mappedMethod = "upi";
      } else {
        // "card" or "online"
        mappedMethod = "card";
      }

      // Map shipping address fields
      const shippingAddress = {
        fullName: address.fullName,
        phone: address.phone,
        addressLine1: address.addressLine || address.addressLine1 || "",
        addressLine2: address.addressLine2 || "",
        city: address.city,
        state: address.state,
        zipCode: address.postalCode || address.zipCode || "",
        country: address.country || "India",
      };

      // 4️⃣ Create Order
      const order = new Order({
        userId,
        items: orderItems,
        shippingAddress,
        totalAmount,
        shippingFee: shippingFee || 0,
        subtotal: subTotal || (totalAmount - (tax || 0)),
        tax: tax || 0,
        paymentMethod: mappedMethod,
        paymentStatus: "unpaid",
        status: paymentMethod === "cod" ? "confirmed" : "pending",
      });

      const savedOrder = await order.save({ session });

      // 5️⃣ Create Payment record & call Gateway
      let responseData: any = {
        success: true,
        data: savedOrder,
        statusCode: 201,
      };

      if (paymentMethod === "cod") {
        // Finalize inventory: move from reserved to sold
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

        // Create Payment record
        const paymentRecord = new Payment({
          orderId: savedOrder._id,
          userId,
          razorpayOrderId: `cod_${savedOrder._id}`,
          method: "cod",
          status: "pending",
          amount: totalAmount * 100, // in paise
          currency: "INR",
        });
        await paymentRecord.save({ session });

        responseData.message = "Order placed successfully (COD)";
      } else if (paymentMethod === "card") {
        // Stripe integration
        const stripeSession = await createCheckoutSession({
          product: orderItems,
          orderId: savedOrder._id.toString(),
        });

        if (!stripeSession || !stripeSession.url) {
          throw new Error("Failed to create Stripe checkout session");
        }

        const sessionUrl = stripeSession.url;
        const stripeSessionId = stripeSession.id;

        // Create Payment record
        const paymentRecord = new Payment({
          orderId: savedOrder._id,
          userId,
          razorpayOrderId: `stripe_${stripeSessionId}`,
          method: "online",
          status: "created",
          amount: totalAmount * 100,
          currency: "INR",
        });
        await paymentRecord.save({ session });

        responseData.message = "Stripe checkout session created";
        responseData.url = sessionUrl;
      } else {
        // Razorpay integration ("online" or "upi")
        const razorpayOrder = await getRazorpay().orders.create({
          amount: Math.round(totalAmount * 100),
          currency: "INR",
          receipt: savedOrder._id.toString(),
          notes: {
            orderId: savedOrder._id.toString(),
            userId: userId.toString(),
          },
        });

        if (!razorpayOrder) {
          throw new Error("Failed to create Razorpay order");
        }

        // Create Payment record
        const paymentRecord = new Payment({
          orderId: savedOrder._id,
          userId,
          razorpayOrderId: razorpayOrder.id,
          method: "online",
          status: "created",
          amount: totalAmount * 100,
          currency: "INR",
        });
        await paymentRecord.save({ session });

        responseData.message = "Razorpay payment order created";
        responseData.razorpay = {
          orderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          key: process.env.RAZORPAY_KEY_ID,
        };
      }

      // 6️⃣ Clear Cart
      cart.items = [];
      cart.totalAmount = 0;
      cart.totalItems = 0;
      await cart.save({ session });

      return responseData;
    });

    return res.status(result.statusCode || 200).json({
      success: result.success,
      message: result.message,
      data: result.data,
      url: result.url || undefined,
      razorpay: result.razorpay || undefined,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Checkout failed",
    });
  }
};
