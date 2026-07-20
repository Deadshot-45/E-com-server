import { Request, Response } from "express";
import mongoose from "mongoose";
import { ProductVariant } from "../models/ProductVariant.js";
import { Cart } from "../models/Cart.js";
import { Inventory } from "../models/Inventory.js";

export const getCart = async (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "User not authenticated",
    });
  }

  const cart = await Cart.findOne({ userId })
    .populate({
      path: "items.variantId",
      model: "ProductVariant",
      populate: {
        path: "productId",
        model: "Product",
        select: "name images",
      },
    })
    .populate({
      path: "items.sellerId",
      model: "User",
      select: "name",
    });

  if (!cart) {
    return res.status(200).json({
      success: true,
      message: "Cart is empty",
      code: "CART_EMPTY",
      data: [],
    });
  }

  const formattedItems = cart.items.map((item: any) => {
    const variant = item.variantId;
    const product = variant?.productId;
    const seller = item.sellerId;

    const primaryImage =
      variant?.images?.find((img: any) => img.isPrimary)?.url ||
      product?.images?.[0]?.url ||
      "";

    return {
      id: variant?._id,

      productId: product?._id,
      name: product?.name || "Unknown Product",

      price: item.priceSnapshot,

      image: primaryImage,

      size: item.size || variant?.attributes?.size,
      color: item.color || variant?.attributes?.color,

      quantity: item.quantity,

      sellerId: seller?._id,
      sellerName: seller?.name || "Unknown Seller",

      isSelected: item.isSelected,
    };
  });

  return res.status(200).json({
    success: true,
    message: "Cart retrieved successfully",
    code: "CART_FETCH_SUCCESS",
    data: formattedItems,
  });
};

export const addToCart = async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const { variantId, quantity = 1 } = req.body;

    const variant = await ProductVariant.findById(variantId).lean();

    if (!variant || !variant.isActive) {
      return res.status(404).json({
        success: false,
        message: "Product variant not found",
        code: "VARIANT_NOT_FOUND",
      });
    }

    const stock = await Inventory.findOne({ variantId: new mongoose.Types.ObjectId(variantId) }).lean().then((inventory) => inventory?.stock || 0);

    console.log("Stock available : ", stock);
    
    if (quantity > stock) {
      return res.status(400).json({
        success: false,
        message: `Requested quantity exceeds available stock. Available stock: ${stock}`,
        code: "INSUFFICIENT_STOCK",
      });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [], totalItems: 0, totalAmount: 0 });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.variantId.toString() === variantId,
    );

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += quantity;
    } else {
      cart.items.push({
        variantId: new mongoose.Types.ObjectId(variantId),
        productId: new mongoose.Types.ObjectId(variant.productId.toString()),
        sellerId: new mongoose.Types.ObjectId(variant.sellerId.toString()),
        quantity,
        priceSnapshot: variant.price,
        size: variant.attributes?.size,
        color: variant.attributes?.color,
        isSelected: true,
        appliedCouponId: null as any,
        discountAmount: 0,
      });
    }

    // Recalculate totals directly
    cart.totalItems = cart.items.reduce((acc, item) => acc + item.quantity, 0);
    cart.totalAmount = cart.items.reduce(
      (acc, item) => acc + item.priceSnapshot * item.quantity,
      0,
    );

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Item added to cart",
      code: "CART_ITEM_ADDED",
    });
  } catch (err) {
    console.error("Add to cart error:", err);
    return res.status(500).json({ success: false });
  }
};

export const removeFromCart = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const { variantId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!variantId) {
      return res.status(400).json({
        success: false,
        message: "variantId is required",
      });
    }

    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const item = cart.items.find(
      (i: any) => i.variantId.toString() === variantId,
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
        code: "ITEM_NOT_FOUND",
      });
    }

    // 🔥 remove item
    cart.items = cart.items.filter((i: any) => i.variantId.toString() !== variantId);

    // Recalculate totals directly
    cart.totalItems = cart.items.reduce((acc, i) => acc + i.quantity, 0);
    cart.totalAmount = cart.items.reduce(
      (acc, i) => acc + i.priceSnapshot * i.quantity,
      0,
    );

    if (cart.totalItems < 0) cart.totalItems = 0;
    if (cart.totalAmount < 0) cart.totalAmount = 0;

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Item removed from cart",
      code: "CART_ITEM_REMOVED",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const decrementFromCart = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const { variantId, quantity = 1 } = req.body;

    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    const item = cart.items.find((i: any) => i.variantId.toString() === variantId);

    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    const reduceQty = Math.min(quantity, item.quantity);

    item.quantity -= reduceQty;

    if (item.quantity <= 0) {
      cart.items = cart.items.filter(
        (i) => i.variantId.toString() !== variantId,
      );
    }

    // Recalculate totals directly
    cart.totalItems = cart.items.reduce((acc, i) => acc + i.quantity, 0);
    cart.totalAmount = cart.items.reduce(
      (acc, i) => acc + i.priceSnapshot * i.quantity,
      0,
    );

    if (cart.totalItems < 0) cart.totalItems = 0;
    if (cart.totalAmount < 0) cart.totalAmount = 0;

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Cart updated",
      code: "CART_ITEM_DECREMENTED",
    });
  } catch (err) {
    return res.status(500).json({ success: false });
  }
};
