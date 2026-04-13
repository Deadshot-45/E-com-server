import { NextFunction, Request, Response } from "express";
import { blockedIPs } from "./ipBlockStore.js";

const SENSITIVE_WINDOW_MS = 15 * 60 * 1000; // 15 min
const BLOCK_DURATION_MS = 30 * 60 * 1000; // 30 min block

const ipAttempts = new Map<string, { count: number; first: number }>();

export const sensitiveSecurityMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const ip = req.ip;
  if (!ip) {
    return next();
  }

  const now = Date.now();

  const record = ipAttempts.get(ip) || { count: 0, first: now };

  // window reset
  if (now - record.first > SENSITIVE_WINDOW_MS) {
    record.count = 0;
    record.first = now;
  }

  record.count += 1;
  ipAttempts.set(ip, record);

  if (record.count > 10) {
    blockedIPs.set(ip, now + BLOCK_DURATION_MS);
    ipAttempts.delete(ip);
    return res.status(403).json({
      success: false,
      message:
        "Too many attempts from your IP. You are temporarily blocked for 30 minutes.",
      code: "IP_TEMP_BLOCKED",
    });
  }

  next();
};
