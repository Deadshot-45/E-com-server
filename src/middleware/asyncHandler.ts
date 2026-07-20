// middleware/asyncHandler.ts
import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async Express handler and forwards any rejected promise to next(),
 * so all errors flow through the global error handler automatically.
 */
export const asyncHandler =
  <P = any, ResBody = any, ReqBody = any, ReqQuery = any>(
    fn: (
      req: Request<P, ResBody, ReqBody, ReqQuery>,
      res: Response<ResBody>,
      next: NextFunction,
    ) => Promise<any>,
  ): RequestHandler<P, ResBody, ReqBody, ReqQuery> =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
