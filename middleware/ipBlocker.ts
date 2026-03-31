import { NextFunction, Request, Response } from "express";
import { blockedIPs } from "./ipBlockStore.js";

export const ipBlockerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const ip = req.ip;
  if (!ip) {
    return next();
  }

  const now = Date.now();

  const unblockTime = blockedIPs.get(ip);
  if (unblockTime && now < unblockTime) {
    return res.status(403).json({
      success: false,
      message: "Your IP is temporarily blocked due to suspicious activity.",
      code: "IP_BLOCKED",
    });
  }

  if (unblockTime && now >= unblockTime) {
    blockedIPs.delete(ip);
  }

  next();
};
