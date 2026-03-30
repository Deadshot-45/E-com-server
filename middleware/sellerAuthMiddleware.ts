import { Request, Response, NextFunction } from "express-serve-static-core";
import Seller, { ISeller } from "../models/Seller.js";
import { verifyJWT } from "../utils/authUtils.js";

export interface SellerRequest extends Request {
  seller?: ISeller;
}

export const sellerAuthMiddleware = async (req: SellerRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers?.authorization;
  const token = authHeader?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token" });
  }

  const decoded = verifyJWT(token) as { id: string } | null;
  if (!decoded) {
    return res.status(401).json({ message: "Invalid token" });
  }

  const seller = await Seller.findById(decoded.id);
  if (!seller || !seller.isVerified) {
    return res.status(403).json({ message: "Seller not verified" });
  }

  req.seller = seller;
  next();
};
