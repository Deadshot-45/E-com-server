import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import User, { IUser } from "../models/User.js";
import AppError from "../utils/AppError.js";

interface DecodedToken {
  userId: string;
  iat: number;
  exp: number;
}

// Extend the Express Request object to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

/**
 * Middleware to protect routes that require authentication.
 * It checks for the presence and validity of a JWT in the Authorization header.
 */
export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // 1) Get token and check if it exists
    let token: string | undefined;

    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next(
        new AppError(
          "You are not logged in! Please log in to get access.",
          401,
        ),
      );
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

    const id = decoded.userId;

    // 3) Check if user still exists
    const currentUser = await User.findById(id);

    if (!currentUser) {
      return next(
        new AppError("The user belonging to this token no longer exists.", 401),
      );
    }

    // 4) Check if user is active
    if (!currentUser.isActive) {
      return next(new AppError("This user account has been deactivated.", 401));
    }

    // 5) Grant access to protected route
    req.user = currentUser;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to restrict access to certain user roles (e.g., admin).
 * MUST be used after the protect middleware.
 */
export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action.", 403),
      );
    }
    next();
  };
};
