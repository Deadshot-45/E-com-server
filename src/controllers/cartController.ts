import { Request, Response } from "express";
import { Cart } from "../models/Cart";

export const getCart = async (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    return res
      .status(401)
      .json({ success: false, message: "User not authenticated" });
  }

  const cart = await Cart.findOne({ userId })
    .populate({
      path: "items.productId",
      model: "Product",
      select: "name price images",
    })
    .populate({
      path: "items.sellerId",
      model: "Seller",
      select: "name",
    });

  if (!cart) {
    return res
      .status(200)
      .json({ success: true, message: "Cart not found", cart: [] });
  }

  const formattedItems = cart.items.map((item: any) => {
    const product = item.productId;
    const seller = item.sellerId;
    const primaryImage =
      product?.images?.find((img: any) => img.isPrimary)?.url ||
      product?.images?.[0]?.url ||
      "";

    return {
      id: product?._id || item.productId,
      name: product?.name || "Unknown Product",
      price: product?.price || item.priceSnapshot,
      image: primaryImage,
      size: item.size,
      quantity: item.quantity,
      sellerId: seller?._id || item.sellerId,
      sellerName: seller?.name || "Unknown Seller",
    };
  });

  res.status(200).json({
    success: true,
    message: "Cart fetched successfully",
    cart: formattedItems,
  });
};

export const addToCart = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const { productId, sellerId, quantity, size, priceSnapshot } = req.body;

    // 🔒 Basic validation
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!productId || !sellerId || !size || !quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payload",
      });
    }

    /**
     * STEP 1:
     * Try to update existing item (same productId + size)
     */
    const updatedCart = await Cart.findOneAndUpdate(
      {
        userId,
        "items.productId": productId,
        "items.size": size,
      },
      {
        $inc: { "items.$.quantity": quantity },
        $set: { updatedAt: new Date() },
      },
      { new: true },
    );

    if (updatedCart) {
      return res.status(200).json({
        success: true,
        message: "Cart updated (quantity increased)",
        cart: updatedCart,
      });
    }

    /**
     * STEP 2:
     * If item not found → push new item
     */
    const newCart = await Cart.findOneAndUpdate(
      { userId },
      {
        $push: {
          items: {
            productId,
            sellerId,
            size,
            quantity,
            priceSnapshot,
          },
        },
        $set: { updatedAt: new Date() },
      },
      {
        new: true,
        upsert: true, // create cart if not exists
      },
    );

    return res.status(201).json({
      success: true,
      message: "Item added to cart",
      cart: newCart,
    });
  } catch (error) {
    console.error("Add to cart error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
