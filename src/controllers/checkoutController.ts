import { Request, Response } from "express";
import mongoose from "mongoose";
import { Cart } from "../models/Cart";
import { ProductVariant } from "../models/Product";
import { Inventory } from "../models/Inventory";
import { Order } from "../models/Order";

/**
 * @swagger
 * /api/checkout:
 *   post:
 *     summary: Checkout cart and create order
 *     tags: [Order]
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
 *                 example: cod
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
 *                     example: 9876543210
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
 *                     example: 452001
 *                   country:
 *                     type: string
 *                     example: India
 *     responses:
 *       201:
 *         description: Order placed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Order placed successfully
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

    const userId = req.user?._id; // assume auth middleware

    const { address, paymentMethod } = req.body;

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

      const available = inventory.quantity - inventory.reserved;

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
        name: variant.attributes?.name || item.name,
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
    const order = await Order.create(
      [
        {
          userId,
          items: orderItems,
          totalAmount,
          totalItems,
          paymentMethod,
          paymentStatus: paymentMethod === "cod" ? "pending" : "pending",
          status: "pending",
          address,
        },
      ],
      { session },
    );

    // 6️⃣ Clear Cart
    cart.items = [];
    cart.totalAmount = 0;
    cart.totalItems = 0;
    await cart.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: order[0],
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
