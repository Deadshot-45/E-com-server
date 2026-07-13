import express from "express";
import jwt from "jsonwebtoken";
import axios from "axios";
import User from "../models/User.js";
import Customer from "../models/Customer.js";
import { loginUser } from "../utils/sessionHelpers.js";
import { hashPassword } from "../utils/passwordUtils.js";
import crypto from "crypto";

let googlePublicKeys: Record<string, string> = {};
let keysExpiryTime = 0;

async function getGooglePublicKeys() {
  const now = Date.now();
  if (Object.keys(googlePublicKeys).length === 0 || now > keysExpiryTime) {
    const res = await axios.get(
      "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
    );
    googlePublicKeys = res.data;
    keysExpiryTime = now + 3600000; // Cache for 1 hour
  }
  return googlePublicKeys;
}

export async function verifyFirebaseToken(token: string) {
  const decodedToken = jwt.decode(token, { complete: true }) as any;
  if (!decodedToken || typeof decodedToken === "string") {
    throw new Error("Invalid token format");
  }

  const kid = decodedToken.header.kid;
  if (!kid) {
    throw new Error("Token header missing kid");
  }

  const keys = await getGooglePublicKeys();
  const publicKeyPem = keys[kid];
  if (!publicKeyPem) {
    throw new Error("Public key not found for kid");
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "vault-vogue";

  const payload = jwt.verify(token, publicKeyPem, {
    algorithms: ["RS256"],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
  }) as any;

  return payload;
}

export const googleLogin = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No bearer token provided.",
        code: "UNAUTHORIZED",
      });
    }

    const token = authHeader.split(" ")[1];
    const firebaseUser = await verifyFirebaseToken(token);

    if (!firebaseUser || !firebaseUser.email) {
      return res.status(400).json({
        success: false,
        message: "Invalid Firebase token payload.",
        code: "INVALID_PAYLOAD",
      });
    }

    const email = firebaseUser.email.trim().toLowerCase();
    const fullName = firebaseUser.name || "Google User";
    const profilePicture = firebaseUser.picture || "";

    // Find user by email
    let user = await User.findOne({ email });
    let customer: any = null;

    if (!user) {
      // Create a new user since they signed in via Google first time
      const randomPassword = crypto.randomBytes(16).toString("hex");
      const hashedPassword = await hashPassword(randomPassword);

      user = await User.create({
        email,
        passwordHash: hashedPassword,
        role: "customer",
        isActive: true,
      });

      customer = await Customer.create({
        userId: user._id,
        fullName,
        profilePicture,
      });
    } else {
      customer = await Customer.findOne({ userId: user._id });
      if (!customer) {
        customer = await Customer.create({
          userId: user._id,
          fullName,
          profilePicture,
        });
      } else if (profilePicture && !customer.profilePicture) {
        customer.profilePicture = profilePicture;
        await customer.save();
      }
    }

    // Generate JWT token matching standard login
    const sessionToken = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role || "customer",
      },
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

    // Create session
    loginUser(
      req,
      {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      res,
      (err) => {
        if (err) {
          console.error("Social login session creation failed:", err);
          return res.status(500).json({
            success: false,
            message: "Login failed due to session error.",
            code: "SESSION_ERROR",
          });
        }

        res.json({
          success: true,
          message: "Logged in successfully with Google",
          data: {
            token: sessionToken,
            user: safeUserData,
            sessionActive: true,
          },
        });
      }
    );
  } catch (error: any) {
    console.error("Google authentication mapping error:", error);
    res.status(401).json({
      success: false,
      message: error.message || "Google login failed.",
      code: "AUTHENTICATION_FAILED",
    });
  }
};
