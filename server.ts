import cors from "cors";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import session from "express-session";
import mongoose from "mongoose";
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import swaggerUi from "swagger-ui-express";
import { logger as sharedLogger } from "./src/utils/logger.js";
import type { Logger } from "winston";


// Middleware & Utils
import { globalErrorHandler } from "./src/middleware/errorMiddleware.js";
import AppError from "./src/utils/AppError.js";
import { swaggerSpec } from "./src/utils/swagger.js";

// Routes
import { ipBlockerMiddleware } from "./src/middleware/ipBlocker.js";
import { sensitiveSecurityMiddleware } from "./src/middleware/sensitiveSecurityMiddleware.js";
import authController from "./src/routes/auth.routes.js";
import cartRoutes from "./src/routes/cart.routes.js";
import marketplaceRoutes from "./src/routes/marketplace.routes.js";
import orderRoutes from "./src/routes/order.routes.js";
import paymentRoutes from "./src/routes/payment.routes.js";
import otpRoutes from "./src/routes/otp.routes.js";
import productRoutes from "./src/routes/product.routes.js";
import reviewRoutes from "./src/routes/review.routes.js";
import sellerRoutes from "./src/routes/seller.routes.js";
import sellerAuthRoutes from "./src/routes/seller-auth.routes.js";
import userRoutes from "./src/routes/user.routes.js";
import landingRoutes from "./src/routes/landing.routes.js";
import dashboardRoutes from "./src/routes/dashboard.routes.js";
import adminRoutes from "./src/routes/admin.routes.js";
import orderTrackingRoutes from "./src/routes/orderRoutes.js";
import paymentTrackingRoutes from "./src/routes/paymentRoutes.js";
import webhookRoutes from "./src/routes/webhookRoutes.js";
import { googleLogin } from "./src/controllers/authController.controller.js";
import Upload from "./src/models/Upload.js";
import { seedAdminUser } from "./src/utils/seedAdmin.js";

dotenv.config();

import helmetImport from "helmet";
import rateLimitImport from "express-rate-limit";

const helmet = (helmetImport as any).default || helmetImport;
const rateLimit = (rateLimitImport as any).default || rateLimitImport;

const PORT = process.env.PORT || 5000;

class Server {
  public app: express.Application;
  private readonly port: string | number;
  private readonly logger: Logger;

  constructor() {
    this.app = express();
    this.port = PORT;
    this.logger = this.initLogger();
    this.middlewares();
    this.routes();
    this.errorHandlers();
  }

  private initLogger() {
    return sharedLogger;
  }

  private middlewares(): void {
    // Trust proxy for Vercel
    this.app.set("trust proxy", 1);

    // Security
    this.app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" },
        crossOriginEmbedderPolicy: false,
        hidePoweredBy: true,
      }),
    );

    // CORS
    const allowedOrigins = new Set([
      "https://vogue-vault-blue.vercel.app",
      "http://localhost:5173",
      "http://localhost:3000/",
      "https://vault-vogue-expressjs.vercel.app",
      "http://localhost:3000",
      "http://192.168.6.167:3000",
      "https://vault-vogue-lite.vercel.app",
      "https://mayank-sahu.vercel.app",
      "https://mayank-sahu-dev.vercel.app",
      "https://checkout.stripe.com/",
    ]);

    this.app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin || allowedOrigins.has(origin)) {
            callback(null, true);
          } else {
            callback(new Error("Not allowed by CORS"));
          }
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: [
          "Content-Type",
          "Authorization",
          "Cookie",
          "X-Requested-With",
          "Accept",
          "Origin",
          "Idempotency-Key",
          "idempotency-key",
          "stripe-signature",
        ],
        exposedHeaders: ["Content-Range"],
        maxAge: 86400,
      }),
    );

    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: process.env.NODE_ENV === "production" ? 100 : 1000,
      skip: (req: Request) =>
        req.method === "OPTIONS" ||
        req.path.startsWith("/p_img") ||
        /\.(png|jpg|jpeg|gif|webp|css|js|ico)$/i.test(req.path),
      message: "Too many requests, please try again later.",
      standardHeaders: true,
      legacyHeaders: false,
    });

    // Static Files
    this.app.use(express.static(path.join(process.cwd(), "public")));

    this.app.use("/api", apiLimiter);
    // Stripe Webhook requires raw body Buffer for cryptographic signature verification
    this.app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true }));

    // Session
    this.app.use(
      session({
        secret: process.env.SESSION_SECRET || "default_session_secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: process.env.NODE_ENV === "production",
          httpOnly: true,
          sameSite: "strict",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        },
      }),
    );

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      this.logger.info(`${req.method} ${req.url} [${req.ip}]`);
      next();
    });
    this.app.disable("x-powered-by");
  }

  private readonly sensitiveLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
      success: false,
      message: "Too many requests, please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  private readonly authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request) => req.method === "OPTIONS",
    skipSuccessfulRequests: true,
    message: {
      success: false,
      message: "Too many requests, please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
    },
  });

  private routes(): void {
    // Auth routes with strict security
    this.app.use(
      "/api/authController",
      this.authLimiter,
      ipBlockerMiddleware,
      sensitiveSecurityMiddleware,
      authController,
    );

    // Seller routes with strict security
    this.app.use(
      "/api/auth/seller",
      this.authLimiter,
      ipBlockerMiddleware,
      sensitiveSecurityMiddleware,
      sellerAuthRoutes,
    );

    // Google Auth Route
    this.app.use(
      "/api/auth/google",
      this.authLimiter,
      ipBlockerMiddleware,
      sensitiveSecurityMiddleware,
      googleLogin,
    );

    // User routes with strict security
    this.app.use(
      "/api/userController",
      this.authLimiter,
      ipBlockerMiddleware,
      sensitiveSecurityMiddleware,
      userRoutes,
    );

    // Admin routes with strict security
    this.app.use(
      "/api/admin",
      this.authLimiter,
      ipBlockerMiddleware,
      sensitiveSecurityMiddleware,
      adminRoutes,
    );

    // Other routes
    this.app.use("/api/products", productRoutes);
    this.app.use("/api/landing", landingRoutes);

     // Health check endpoint
    this.app.get("/api/health", (_req, res) => {
      res
        .status(200)
        .json({
          status: "ok",
          service: "vault-vogue-lite-server",
          timestamp: new Date().toISOString(),
        });
    });

    // Order & Payment Tracking System routes
    this.app.use("/api/orders", orderTrackingRoutes);
    this.app.use("/api/orders", orderRoutes);
    this.app.use("/api/payments", paymentTrackingRoutes);
    this.app.use("/api/payments", paymentRoutes);
    this.app.use("/api/webhooks", webhookRoutes);

    this.app.use("/api/cartController", cartRoutes);
    this.app.use("/api/reviews", reviewRoutes);
    this.app.use("/api/sellers", sellerRoutes);
    this.app.use("/api/marketplace", marketplaceRoutes);
    this.app.use("/api/dashboard", dashboardRoutes);

    // Sensitive OTP/KYC
    this.app.use(
      "/api/ekycController",
      this.sensitiveLimiter,
      ipBlockerMiddleware,
      sensitiveSecurityMiddleware,
      otpRoutes,
    );

    const SWAGGER_CSS_URL =
      "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css";
    const SWAGGER_JS_URLS = [
      "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.min.js",
    ];

    // Raw swagger JSON
    this.app.get("/api-docs/swagger.json", (_req, res) => {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.status(200).json(swaggerSpec);
    });

    this.app.head("/api-docs/swagger.json", (_req, res) => {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.status(200).end();
    });

    // Standalone HTML Swagger UI route for 100% Vercel compatibility
    const renderSwaggerHtml = (_req: Request, res: Response) => {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Vault Vogue API Documentation</title>
  <link rel="stylesheet" href="${SWAGGER_CSS_URL}" />
  <style>
    html { box-sizing: border-box; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin:0; background: #fafafa; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${SWAGGER_JS_URLS[0]}"></script>
  <script src="${SWAGGER_JS_URLS[1]}"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: "/api-docs/swagger.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>`);
    };

    this.app.get("/docs", renderSwaggerHtml);
    this.app.get("/api-docs-html", renderSwaggerHtml);

    // Swagger UI with CDN asset fallback for Vercel Serverless
    this.app.use(
      "/api-docs",
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec, {
        explorer: true,
        customSiteTitle: "Vault Vogue API Documentation",
        customCssUrl: SWAGGER_CSS_URL,
        customJs: SWAGGER_JS_URLS,
        customCss: `
          .swagger-ui .topbar { display: none }
          .swagger-ui .info { margin: 20px 0 }
        `,
      }),
    );

    // Serve uploads from MongoDB with fallback to local files
    this.app.get("/uploads/:filename", async (req: Request, res: Response) => {
      try {
        const filename = req.params.filename as string;
        const upload = await Upload.findOne({ filename });
        if (upload) {
          res.setHeader("Content-Type", upload.contentType);
          return res.send(upload.data);
        }
      } catch (error) {
        this.logger.error("Failed to fetch upload from MongoDB:", error);
      }

      try {
        const filename = req.params.filename as string;
        const localPath = path.join(process.cwd(), "public/uploads", filename);
        if (fs.existsSync(localPath)) {
          return res.sendFile(localPath);
        }
      } catch (fsError) {
        this.logger.error("Failed to check or serve local file:", fsError);
      }

      return res
        .status(404)
        .json({ success: false, message: "File not found" });
    });

    // Health
    this.app.get("/", (req, res) => {
      res.json({
        message: "Vault Vogue Lite API ✅",
        version: "1.0.0",
        env: process.env.NODE_ENV,
      });
    });

    // NOTE: Error handling is delegated entirely to globalErrorHandler
    // (registered in errorHandlers()). Do NOT add a second error-handler here
    // as it would intercept errors before globalErrorHandler can normalise them.
  }

  private errorHandlers(): void {
    // 404 handler — Express 5 compatible
    this.app.all(
      "/{*splat}",
      (req: Request, res: Response, next: NextFunction) => {
        next(new AppError(`Route ${req.originalUrl} not found`, 404));
      },
    );

    // Global error handler
    this.app.use(globalErrorHandler);
  }

  public async connectDB(): Promise<void> {
    const MONGO_URI =
      process.env.MONGO_URI || "mongodb://localhost:27017/vault-vogue-lite";

    try {
      await mongoose.connect(MONGO_URI, {
        retryWrites: false,
      });
      this.logger.info("✅ MongoDB Connected");
      await seedAdminUser();

      mongoose.connection.on("error", (err) => {
        this.logger.error("MongoDB error:", err);
      });
    } catch (error: any) {
      this.logger.error("MongoDB connection failed:", error);
      throw error;
    }
  }

  public listen(): void {
    const PORT = this.port;

    this.app.listen(PORT, () => {
      this.logger.info(`🚀 Server running on port ${PORT}`);
    });
  }

  public getLogger(): Logger {
    return this.logger;
  }

  public async close(): Promise<void> {
    await mongoose.connection.close();
    this.logger.info("Server closed gracefully");
  }
}

export { Server };

const server = new Server();
const dbReady =
  mongoose.connection.readyState === 1
    ? Promise.resolve()
    : server.connectDB().catch((error: unknown) => {
        server
          .getLogger()
          .warn("Database unavailable; continuing for public routes", error);
      });

export const serverHandler = async (req: Request, res: Response) => {
  const pathname = req.url?.split("?")[0] ?? "/";
  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/api-docs") ||
    pathname === "/health" ||
    pathname === "/favicon.ico";

  try {
    if (!isPublicRoute) {
      await dbReady;
    }
    return server.app(req, res);
  } catch (error: any) {
    server.getLogger().error("Request failed before app handling:", error);
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        success: false,
        message: "Database connection unavailable",
      }),
    );
  }
};

export default serverHandler;

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  // ─── Process-level safety nets ─────────────────────────────────────────────
  // Catch any synchronous exception that escapes all try/catch blocks.
  process.on("uncaughtException", (err: Error) => {
    server.getLogger().error("UNCAUGHT EXCEPTION 💥 — shutting down", {
      name: err.name,
      message: err.message,
      stack: err.stack,
    });
    process.exit(1);
  });

  // Catch any unhandled promise rejection.
  process.on("unhandledRejection", (reason: unknown) => {
    server.getLogger().error("UNHANDLED REJECTION 💥 — shutting down", {
      reason: String(reason),
    });
    server.close().finally(() => process.exit(1));
  });

  process.on("SIGTERM", async () => {
    server.getLogger().info("SIGTERM received — closing server gracefully");
    await server.close();
    process.exit(0);
  });

  await dbReady;
  server.listen();
  server.getLogger().info(`🚀 Vault Vogue Server running on http://localhost:${PORT}`);
  server.getLogger().info(`📦 Order Tracking: http://localhost:${PORT}/api/orders/:id/track`);
  server.getLogger().info(`💳 Payment Tracking: http://localhost:${PORT}/api/payments/:id/status`);
  server.getLogger().info(`🔔 Webhooks: http://localhost:${PORT}/api/webhooks/payment`);
}
