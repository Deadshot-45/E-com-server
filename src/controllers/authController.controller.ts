import express from "express";
import jwt from "jsonwebtoken";
import axios from "axios";
import User from "../models/User.js";
import Customer from "../models/Customer.js";
import { loginUser } from "../utils/sessionHelpers.js";
import { hashPassword } from "../utils/passwordUtils.js";
import crypto from "crypto";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  UnauthorizedError,
  BadRequestError,
  NotFoundError,
} from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

let googlePublicKeys: Record<string, string> = {};
let keysExpiryTime = 0;

async function getGooglePublicKeys() {
  const now = Date.now();
  if (Object.keys(googlePublicKeys).length === 0 || now > keysExpiryTime) {
    const res = await axios.get(
      "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
    );
    googlePublicKeys = res.data;
    keysExpiryTime = now + 3_600_000; // Cache for 1 hour
  }
  return googlePublicKeys;
}

export async function verifyFirebaseToken(token: string) {
  const decodedToken = jwt.decode(token, { complete: true }) as any;
  if (!decodedToken || typeof decodedToken === "string") {
    throw new UnauthorizedError("Invalid token format");
  }

  const kid = decodedToken.header.kid;
  if (!kid) {
    throw new UnauthorizedError("Token header missing kid");
  }

  const keys = await getGooglePublicKeys();
  const publicKeyPem = keys[kid];
  if (!publicKeyPem) {
    throw new UnauthorizedError("Public key not found for kid");
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "vault-vogue";

  return jwt.verify(token, publicKeyPem, {
    algorithms: ["RS256"],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
  }) as any;
}

// ─── Google / Firebase OAuth login ──────────────────────────────────────────

export const googleLogin = asyncHandler(async (
  req: express.Request,
  res: express.Response,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("No bearer token provided.");
  }

  const token = authHeader.split(" ")[1];
  const firebaseUser = await verifyFirebaseToken(token);

  if (!firebaseUser?.email) {
    throw new BadRequestError("Invalid Firebase token payload.", "INVALID_PAYLOAD");
  }

  const email = firebaseUser.email.trim().toLowerCase();
  const fullName: string = firebaseUser.name || "Google User";
  const profilePicture: string = firebaseUser.picture || "";

  let user = await User.findOne({ email });
  let customer: any = null;

  if (!user) {
    const hashedPassword = await hashPassword(crypto.randomBytes(16).toString("hex"));
    user = await User.create({
      email,
      passwordHash: hashedPassword,
      name: fullName,
      role: "customer",
      isActive: true,
    });
    customer = await Customer.create({ userId: user._id, fullName, profilePicture });
  } else {
    customer = await Customer.findOne({ userId: user._id });
    if (!customer) {
      customer = await Customer.create({ userId: user._id, fullName, profilePicture });
    } else if (profilePicture && !customer.profilePicture) {
      customer.profilePicture = profilePicture;
      await customer.save();
    }
  }

  const sessionToken = jwt.sign(
    { userId: user._id, email: user.email, role: user.role || "customer" },
    process.env.JWT_SECRET!,
    { expiresIn: "2h" }
  );

  const safeUserData = {
    id: user._id,
    email: user.email,
    role: user.role,
    fullName: customer?.fullName || "Google User",
    profilePicture: customer?.profilePicture || "",
    phoneNumber: customer?.phoneNumber || "",
    address: customer?.address || "",
  };

  // Wrap callback-style loginUser in a promise so errors surface via asyncHandler
  await new Promise<void>((resolve, reject) => {
    loginUser(
      req,
      { id: user!._id.toString(), email: user!.email, role: user!.role },
      res,
      (err: any) => {
        if (err) {
          logger.error("Social login session creation failed", { error: err });
          reject(new BadRequestError("Login failed due to session error.", "SESSION_ERROR"));
        } else {
          resolve();
        }
      }
    );
  });

  res.json({
    success: true,
    message: "Logged in successfully with Google",
    data: { token: sessionToken, user: safeUserData, sessionActive: true },
  });
});

// ─── Change password ─────────────────────────────────────────────────────────

export const changePassword = asyncHandler(async (
  req: express.Request<{}, {}, { password: string; confirmPassword: string }>,
  res: express.Response,
) => {
  const { password, confirmPassword } = req.body;
  const userId = req.user?._id;

  if (!userId) throw new UnauthorizedError("Unauthorized");

  const user = await User.findById(userId);
  if (!user) throw new NotFoundError("User not found");

  if (!password || !confirmPassword || password !== confirmPassword) {
    throw new BadRequestError("Passwords do not match", "INVALID_PASSWORD");
  }

  user.passwordHash = await hashPassword(confirmPassword);
  await user.save();

  res.json({ success: true, message: "Password changed successfully", code: "PASSWORD_CHANGED" });
});
