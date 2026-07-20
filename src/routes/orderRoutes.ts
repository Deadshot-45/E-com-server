import express, { Request, Response } from "express";
import { orderService } from "../services/order-service.js";

const router = express.Router();

/**
 * GET /api/orders/:id/track
 * Fetch real-time tracking details and checkpoint history for an order.
 */
router.get("/:id/track", async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id as string;
    const trackingInfo = await orderService.getOrderTracking(orderId);

    console.log("TrackInfo :", trackingInfo);

    return res.status(200).json({
      success: true,
      message: "Order tracking details retrieved successfully",
      data: trackingInfo,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to retrieve order tracking",
    });
  }
});

/**
 * POST /api/orders/:id/track
 * Add a new tracking checkpoint / status update for an order.
 */
router.post("/:id/track", async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id as string;
    const { status, location, description } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status field is required",
      });
    }

    const updatedOrder = await orderService.updateOrderStatus(
      orderId,
      status,
      location,
      description
    );

    return res.status(200).json({
      success: true,
      message: "Order tracking status updated successfully",
      data: updatedOrder,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to update order tracking status",
    });
  }
});

export default router;
