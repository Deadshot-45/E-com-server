import { Request, Response, NextFunction } from "express";
import AppError from "../utils/AppError.js";

// Handle matching MongoDB duplicate key errors
const handleDuplicateFieldsDB = (err: any) => {
  const field = Object.keys(err.keyValue || {})[0];
  const value = err.keyValue?.[field];

  const message = `Duplicate value for ${field}: ${value}`;
  return new AppError(message, 400, "DUPLICATE_FIELD");
};

// Handle generic mongoose validation errors
const handleValidationErrorDB = (err: any) => {
  const errors = Object.values(err.errors).map((el: any) => el.message);

  return new AppError(
    `Invalid input data. ${errors.join(". ")}`,
    400,
    "VALIDATION_ERROR",
  );
};

// Handle invalid mongodb object ID
const handleCastErrorDB = (err: any) => {
  return new AppError(`Invalid ${err.path}: ${err.value}`, 400, "INVALID_ID");
};

const sendErrorDev = (err: AppError, res: Response) => {
  res.status(err.statusCode).json({
    success: false,
    status: err.status,
    code: err.code,
    message: err.message,
    error: err,
    stack: err.stack,
  });
};

const sendErrorProd = (err: AppError, res: Response) => {
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      code: err.code,
      message: err.message,
    });
  }

  // Log error
  console.error("ERROR 💥", err);

  return res.status(500).json({
    success: false,
    status: "error",
    code: "INTERNAL_SERVER_ERROR",
    message: "Something went wrong",
  });
};

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, res);
  } else {
    // We clone the error object so we don't mutate the original one for node
    let error = { ...err };
    error.message = err.message;
    error.name = err.name; // Keep name for specific checks

    if (error.name === "CastError") error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === "ValidationError")
      error = handleValidationErrorDB(error);

    sendErrorProd(error, res);
  }
};
