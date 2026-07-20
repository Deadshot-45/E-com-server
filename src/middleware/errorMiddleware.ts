import { Request, Response, NextFunction } from "express";
import AppError from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

// ─── MongoDB error normalisers ────────────────────────────────────────────────

/** E11000 duplicate-key error */
const handleDuplicateFieldsDB = (err: any): AppError => {
  const field = Object.keys(err.keyValue || {})[0];
  const value = err.keyValue?.[field];
  return new AppError(
    `Duplicate value for ${field}: "${value}"`,
    409,
    "DUPLICATE_FIELD",
  );
};

/** Mongoose schema validation errors — returns per-field details */
const handleValidationErrorDB = (err: any): AppError => {
  const errors = Object.values(err.errors).map((el: any) => ({
    field: el.path,
    message: el.message,
  }));
  const error = new AppError(
    `Validation failed: ${errors.map((e) => e.message).join(". ")}`,
    400,
    "VALIDATION_ERROR",
  ) as any;
  error.errors = errors;
  return error;
};

/** Invalid MongoDB ObjectId */
const handleCastErrorDB = (err: any): AppError =>
  new AppError(`Invalid ${err.path}: ${err.value}`, 400, "INVALID_ID");

// ─── JWT error normalisers ────────────────────────────────────────────────────

/** Tampered or malformed token */
const handleJWTError = (): AppError =>
  new AppError("Invalid token. Please log in again.", 401, "INVALID_TOKEN");

/** Expired token */
const handleJWTExpiredError = (): AppError =>
  new AppError("Your token has expired. Please log in again.", 401, "TOKEN_EXPIRED");

// ─── Response senders ─────────────────────────────────────────────────────────

const sendErrorDev = (err: AppError & { errors?: any[] }, res: Response): void => {
  res.status(err.statusCode).json({
    success: false,
    status: err.status,
    code: err.code,
    message: err.message,
    ...(err.errors && { errors: err.errors }),
    error: err,
    stack: err.stack,
  });
};

const sendErrorProd = (err: AppError & { errors?: any[] }, res: Response): void => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      status: err.status,
      code: err.code,
      message: err.message,
      ...(err.errors && { errors: err.errors }),
    });
    return;
  }

  // Non-operational (programming bug): log internally, hide details from client
  logger.error("Unhandled server error", {
    message: err.message,
    stack: err.stack,
    code: err.code,
  });

  res.status(500).json({
    success: false,
    status: "error",
    code: "INTERNAL_SERVER_ERROR",
    message: "Something went wrong. Please try again later.",
  });
};

// ─── Global error handler ─────────────────────────────────────────────────────

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    logger.debug(`${req.method} ${req.originalUrl} → ${err.statusCode} ${err.message}`);
    sendErrorDev(err, res);
    return;
  }

  // Production: normalise known error types before responding
  let error: AppError = Object.assign(Object.create(Object.getPrototypeOf(err)), err);
  error.message = err.message;
  error.name = err.name;

  if (error.name === "CastError") error = handleCastErrorDB(error);
  if ((error as any).code === 11000) error = handleDuplicateFieldsDB(error);
  if (error.name === "ValidationError") error = handleValidationErrorDB(error);
  if (error.name === "JsonWebTokenError") error = handleJWTError();
  if (error.name === "TokenExpiredError") error = handleJWTExpiredError();

  sendErrorProd(error as any, res);
};
