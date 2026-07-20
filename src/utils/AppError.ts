// src/utils/AppError.ts

/**
 * Base operational error class.
 * All sub-classes are considered "operational" (expected, user-facing) errors
 * and will be serialised cleanly by the global error handler.
 */
export default class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;
  code: string;

  constructor(
    message: string,
    statusCode: number,
    code: string = "INTERNAL_SERVER_ERROR",
  ) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Semantic sub-classes ────────────────────────────────────────────────────
// Use these in controllers/services instead of hardcoding status codes.

export class BadRequestError extends AppError {
  constructor(message: string, code = "BAD_REQUEST") {
    super(message, 400, code);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", code = "UNAUTHORIZED") {
    super(message, 401, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", code = "FORBIDDEN") {
    super(message, 403, code);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", code = "NOT_FOUND") {
    super(message, 404, code);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = "CONFLICT") {
    super(message, 409, code);
  }
}

/**
 * Use when an upstream/third-party API (Razorpay, Stripe, Firebase …) fails.
 * Returns 502 Bad Gateway so clients know the issue is not their fault.
 */
export class BadGatewayError extends AppError {
  constructor(message: string, code = "BAD_GATEWAY") {
    super(message, 502, code);
  }
}
