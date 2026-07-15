import { Request, Response, NextFunction } from "express-serve-static-core";
import Seller, { ISeller } from "../models/Seller.js";
import jwt from "jsonwebtoken";
import AppError from "../utils/AppError.js";

interface DecodedToken {
  userId: string;
  iat: number;
  exp: number;
}

export interface SellerRequest extends Request {
  seller?: ISeller;
}

export const sellerAuthMiddleware = async (
  req: SellerRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers?.authorization;
  const token = authHeader?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token" });
  }

  // 2) Verify token
      const decoded = await new Promise<DecodedToken>((resolve, reject) => {
        jwt.verify(
          token,
          process.env.JWT_SECRET || "your_secret_key",
          (err, decoded) => {
            if (err)
              return reject(
                new AppError("Invalid token. Please log in again!", 401),
              );
            resolve(decoded as DecodedToken);
          },
        );
      });

  if (!decoded) {
    return res.status(401).json({ message: "Invalid token" });
  }

  const seller = await Seller.findOne({ ownerUserId: decoded.userId });
  if (!seller || !seller.isVerified) {
    return res.status(403).json({ message: "Seller not verified" });
  }

  req.seller = seller;
  next();
};
