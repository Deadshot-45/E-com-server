import express, { Request, Response } from "express";
import { paymentService } from "../services/payment-service.js";

const router = express.Router();

/**
 * POST /api/payments/initialize
 * Initialize payment with strict Idempotency-Key enforcement.
 */
router.post("/initialize", async (req: Request, res: Response) => {
  try {
    const idempotencyKey =
      (req.headers["idempotency-key"] as string) || req.body.idempotencyKey;

    const { orderId, amount, currency, gateway } = req.body;

    const result = await paymentService.initializePayment({
      orderId,
      amount,
      currency: currency || "INR",
      gateway: gateway || "MOCK_GATEWAY",
      idempotencyKey,
    });

    const statusCode = result.isDuplicate ? 200 : 201;

    return res.status(statusCode).json({
      success: true,
      message: result.isDuplicate
        ? "Retrieved existing idempotent payment transaction"
        : "Payment transaction initialized successfully",
      isDuplicate: result.isDuplicate,
      data: result.payment,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to initialize payment",
    });
  }
});

/**
 * GET /api/payments/:id/status
 * Get status of a payment transaction.
 */
router.get("/:id/status", async (req: Request, res: Response) => {
  try {
    const paymentId = req.params.id as string;
    const payment = await paymentService.getPaymentStatus(paymentId);
    return res.status(200).json({
      success: true,
      message: "Payment status retrieved successfully",
      data: payment,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to retrieve payment status",
    });
  }
});

export default router;
