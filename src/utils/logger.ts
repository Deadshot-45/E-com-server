// src/utils/logger.ts
import winston from "winston";

const { combine, timestamp, errors, json, simple } = winston.format;

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: combine(timestamp(), errors({ stack: true }), json()),
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === "production" ? json() : simple(),
    }),
  ],
});
