import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { ISeller } from "../models/Seller.js";

const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key";
const JWT_EXPIRES_IN = "7d";

export const generateJWT = (seller: ISeller): string => {
  return jwt.sign({ id: seller._id, email: seller.contactEmail }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

export const verifyJWT = (token: string): any => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
};

export const hashPassword = async (pwd: string): Promise<string> =>
  await bcrypt.hash(pwd, 12);
export const comparePassword = async (
  pwd: string,
  hash: string,
): Promise<boolean> => await bcrypt.compare(pwd, hash);
