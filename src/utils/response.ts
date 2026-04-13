import { Response } from "express";

interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  code: string;
  data?: T;
}

export const sendResponse = <T>(
  res: Response,
  statusCode: number,
  payload: ApiResponse<T>,
) => {
  return res.status(statusCode).json(payload);
};
