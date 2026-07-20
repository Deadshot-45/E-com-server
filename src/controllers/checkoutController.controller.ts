import { Request, Response } from "express";
import mongoose from "mongoose";
import { Cart } from "../models/Cart.js";
import { Inventory } from "../models/Inventory.js";
import { Payment } from "../models/Payment.js";
import { Product } from "../models/Product.js";
import { ProductVariant } from "../models/ProductVariant.js";
import { getRazorpay, getRazorpayKeys } from "../config/razorpay.js";
import { withTransaction } from "../utils/transaction.js";
import { Order } from "../models/Order.js";
import { createCheckoutSession } from "../utils/stripe.js";
import { trackingStore } from "../store/tracking-store.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { BadRequestError, BadGatewayError, UnauthorizedError } from "../utils/AppError.js";


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
export const checkout = asyncHandler(async (req: Request, res: Response) => {
  const result = await withTransaction(async (session) => {
    const userId = req.user?._id;

    if (!userId) {
      throw new UnauthorizedError("User not authenticated");
    }

      const {
        address,
        paymentMethod,
        shippingMethod,
        promoCode,
      } = req.body;

    const allowedMethods = ["cod", "online", "card", "upi"];
    if (!address || !paymentMethod) {
      throw new BadRequestError("Address and payment method are required");
    }
    if (!allowedMethods.includes(paymentMethod)) {
      throw new BadRequestError(`Invalid payment method. Use one of: ${allowedMethods.join(", ")}`);
    }

    // 1️⃣ Get cart
    const cart = await Cart.findOne({ userId }).session(session || null);

    if (!cart || cart.items.length === 0) {
      throw new BadRequestError("Cart is empty");
    }

      // Compute backend subtotal from variant prices
      let dbSubtotal = 0;
      let totalItems = 0;
      const orderItems: any[] = [];

      // 2️⃣ Validate + Lock inventory
      for (const item of cart.items) {
        const variant = await ProductVariant.findById(item.variantId).session(
          session || null,
        );

        if (!variant) {
          throw new BadRequestError(`Variant not found: ${item.variantId}`);
        }

        const product = await Product.findById(variant.productId).session(
          session || null,
        );

        if (!product || !product.isActive) {
          throw new BadRequestError(`Product not active: ${product?.name}`);
        }

        const inv = await Inventory.findOne({
          variantId: item.variantId,
        }).session(session || null);

        if (!inv || inv.stock < item.quantity) {
          throw new BadRequestError(`Insufficient stock for item: ${product.name}`);
        }

        // 3️⃣ Reserve stock
        inv.stock -= item.quantity;
        inv.reserved += item.quantity;
        await inv.save({ session });

        dbSubtotal += variant.price * item.quantity;
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

      // Calculate discount based on promoCode
      let discount = 0;
      if (promoCode) {
        const code = String(promoCode).trim().toUpperCase();
        if (code.startsWith("WELCOME10")) {
          discount = dbSubtotal * 0.1;
        } else if (code.startsWith("ATELIER5")) {
          discount = Math.min(500, dbSubtotal);
        } else if (code.startsWith("VIPCOMP")) {
          discount = dbSubtotal * 0.15;
        }
      }

      // Calculate shippingFee dynamically based on shippingMethod
      let calculatedShippingFee = 0;
      if (shippingMethod === "vip") {
        calculatedShippingFee = 500;
      } else if (shippingMethod === "express") {
        calculatedShippingFee = 250;
      } else {
        // standard method or fallback
        calculatedShippingFee = dbSubtotal > 999 ? 0 : 99;
      }

      // Calculate tax (8% of subtotal)
      const calculatedTax = dbSubtotal * 0.08;

      // Compute final totalAmount
      const computedTotalAmount = Math.max(
        0,
        dbSubtotal + calculatedShippingFee + calculatedTax - discount,
      );

      // 4️⃣ Create Order
      const order = new Order({
        userId,
        items: orderItems,
        shippingAddress,
        shippingMethod: shippingMethod || "standard",
        shippingFee: calculatedShippingFee,
        subtotal: dbSubtotal,
        tax: calculatedTax,
        discount: discount,
        totalAmount: computedTotalAmount,
        paymentMethod: mappedMethod,
        paymentStatus: "unpaid",
        status: paymentMethod === "cod" ? "confirmed" : "pending",
      });

      const savedOrder = await order.save({ session });

      // Automatically initialize real Order Tracking record
      try {
        await trackingStore.getOrder(savedOrder._id.toString());
      } catch (err) {
        // Non-blocking tracking initialization

      }

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
          amount: Math.round(computedTotalAmount * 100), // in paise
          currency: "INR",
        });
        await paymentRecord.save({ session });

        responseData.message = "Order placed successfully (COD)";
      } else if (paymentMethod === "card") {
        // Stripe integration
        const stripeSession = await createCheckoutSession({
          product: orderItems,
          orderId: savedOrder._id.toString(),
          shippingFee: calculatedShippingFee,
          tax: calculatedTax,
          discount: discount,
        });

        if (!stripeSession || !stripeSession.url) {
          throw new BadGatewayError("Failed to create Stripe checkout session");
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
          amount: Math.round(computedTotalAmount * 100),
          currency: "INR",
        });
        await paymentRecord.save({ session });

        responseData.message = "Stripe checkout session created";
        responseData.url = sessionUrl;
      } else {
        // Razorpay integration ("online" or "upi")
        let razorpayOrderId: string;
        let razorpayAmount: number = Math.round(computedTotalAmount * 100);
        let razorpayCurrency: string = "INR";
        const { keyId } = getRazorpayKeys();

        try {
          const razorpayInstance = getRazorpay();
          const razorpayOrder = await razorpayInstance.orders.create({
            amount: razorpayAmount,
            currency: razorpayCurrency,
            receipt: savedOrder._id.toString(),
            notes: {
              orderId: savedOrder._id.toString(),
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
          if (rzpErr?.statusCode) throw rzpErr; // already an AppError — re-throw
          throw new BadGatewayError(
            `Razorpay order creation failed: ${rzpErr?.message || rzpErr?.error?.description || "Invalid credentials"}`,
          );
        }

        // Create Payment record
        const paymentRecord = new Payment({
          orderId: savedOrder._id,
          userId,
          razorpayOrderId: razorpayOrderId,
          method: "online",
          status: "created",
          amount: razorpayAmount,
          currency: razorpayCurrency,
        });
        await paymentRecord.save({ session });

        responseData.message = "Razorpay payment order created";
        responseData.razorpay = {
          orderId: razorpayOrderId,
          amount: razorpayAmount,
          currency: razorpayCurrency,
          key: keyId,
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
});
