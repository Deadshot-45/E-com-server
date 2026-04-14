// src/utils/AppError.ts
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
