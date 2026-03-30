// utils/sessionHelpers.ts
import express, { RequestHandler, Response } from "express";
import "express-session";

export interface AuthSession {
  isAuthenticated: boolean;
  user: {
    id: string;
    email: string;
    role?: string;
    iat?: number; // Issued at timestamp
  };
}

/**
 * Extend express-session with custom properties
 */
declare module "express-session" {
  interface SessionData {
    isAuthenticated: boolean;
    user: AuthSession["user"];
  }
}

/**
 * Extend Express Request with session typing
 */
declare module "express-serve-static-core" {
  interface Request {
    authSession?: AuthSession;
  }
}

/**
 * Login helper - securely sets user session
 */
export const loginUser = (
  req: express.Request,
  userData: { id: string; email: string; role?: string },
  res: Response,
  callback?: (err?: any) => void,
): void => {
  // Regenerate session ID to prevent fixation attacks
  req.session.regenerate((err) => {
    if (err) {
      console.error("Session regeneration failed:", err);
      if (callback) callback(err);
      return;
    }

    // Set auth data
    req.session.isAuthenticated = true;
    req.session.user = {
      id: userData.id,
      email: userData.email,
      role: userData.role || "user",
      iat: Date.now(),
    };

    // Save session immediately
    req.session.save((err) => {
      if (err) {
        console.error("Session save failed:", err);
        if (callback) callback(err);
        return;
      }

      if (callback) callback(null);
    });
  });
};

/**
 * Logout helper - completely destroys session
 */
export const logoutUser = (
  req: express.Request,
  res: Response,
  callback?: (err?: any) => void,
): void => {
  const sessionId = req.sessionID;

  req.session.destroy((err) => {
    if (err) {
      console.error("Session destroy failed:", err);
      if (callback) callback(err);
      return;
    }

    // Clear session cookie
    res.clearCookie("connect.sid", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    console.log(`Session ${sessionId} destroyed`);
    if (callback) callback(null);
  });
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): RequestHandler => {
  return (req, res, next) => {
    if (!req.session.isAuthenticated || !req.session.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        code: "NOT_AUTHENTICATED",
      });
    }

    // Attach to request for convenience
    req.authSession = req.session as AuthSession;
    next();
  };
};

/**
 * Check specific role
 */
export const requireRole = (roles: string | string[]): RequestHandler[] => {
  return [
    isAuthenticated(),
    (req, res, next) => {
      const userRole = req.session.user?.role || "user";
      const requiredRoles = Array.isArray(roles) ? roles : [roles];

      if (!requiredRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: "Insufficient permissions",
          code: "INSUFFICIENT_PERMISSIONS",
          requiredRoles,
        });
      }

      next();
    },
  ];
};

/**
 * Check session health (expired/invalid)
 */
export const checkSessionHealth = (): RequestHandler => {
  return (req, res, next) => {
    const session = req.session;

    if (session.isAuthenticated && session.user?.iat) {
      const sessionAge = Date.now() - session.user.iat;
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

      if (sessionAge > maxAge) {
        logoutUser(req, res, () => {});
        return res.status(401).json({
          success: false,
          message: "Session expired",
          code: "SESSION_EXPIRED",
        });
      }
    }

    next();
  };
};

/**
 * Get current user from session
 */
export const getCurrentUser = (
  req: express.Request,
): AuthSession["user"] | null => {
  return req.session?.user || null;
};

/**
 * Refresh session (extend expiry)
 */
export const refreshSession = (req: express.Request): void => {
  req.session.touch(); // Updates expiry
};
