import cors from "cors";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import session from "express-session";
import helmet from "helmet";
import mongoose from "mongoose";
import path from "node:path";
import { pathToFileURL } from "node:url";
import swaggerUi from "swagger-ui-express";
import winston from "winston";

// Middleware & Utils
import { globalErrorHandler } from "./src/middleware/errorMiddleware.js";
import AppError from "./src/utils/AppError.js";
import { swaggerSpec } from "./src/utils/swagger.js";

// Routes
import { ipBlockerMiddleware } from "./src/middleware/ipBlocker.js";
import { sensitiveSecurityMiddleware } from "./src/middleware/sensitiveSecurityMiddleware.js";
import authController from "./src/routes/auth.routes.js";
import cartRoutes from "./src/routes/cart.routes.js";
import marketplaceRoutes from "./src/routes/marketplaceRoutes.js";
import orderRoutes from "./src/routes/order.routes.js";
import otpRoutes from "./src/routes/otp.routes.js";
import productRoutes from "./src/routes/product.routes.js";
import reviewRoutes from "./src/routes/review.routes.js";
import sellerRoutes from "./src/routes/seller.routes.js";
import sellerAuthRoutes from "./src/routes/sellerRoutes.js";
import userRoutes from "./src/routes/user.routes.js";

dotenv.config();
class Server {
  public app: express.Application;
  private readonly port: string | number;
  private readonly logger: winston.Logger;

  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.logger = this.initLogger();
    this.middlewares();
    this.routes();
    this.errorHandlers();
  }

  private initLogger(): winston.Logger {
    return winston.createLogger({
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple(),
        }),
      ],
    });
  }

  private middlewares(): void {
    // Trust proxy for Vercel
    // this.app.set("trust proxy", 1);

    // Security
    this.app.use(
      helmet({
        contentSecurityPolicy: false, // API के लिए ठीक
        crossOriginResourcePolicy: { policy: "cross-origin" },
        crossOriginEmbedderPolicy: false,
        hidePoweredBy: true, // X-Powered-By हटाओ
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
        ],
        exposedHeaders: ["Content-Range"],
        maxAge: 86400,
      }),
    );

    // Rate limiting (skip OPTIONS)
    // this.app.use(
    //   rateLimit({
    //     windowMs: 15 * 60 * 1000,
    //     max: process.env.NODE_ENV === "production" ? 100 : 1000,
    //     skip: (req) => req.method === "OPTIONS",
    //     message: "Too many requests, please try again later.",
    //     standardHeaders: true,
    //     legacyHeaders: false,
    //   }),
    // );

    // 2) फिर global rate limit सिर्फ API routes पर
    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: process.env.NODE_ENV === "production" ? 100 : 1000,
      skip: (req) =>
        req.method === "OPTIONS" ||
        req.path.startsWith("/p_img") || // image path जैसा है वैसा skip
        /\.(png|jpg|jpeg|gif|webp|css|js|ico)$/i.test(req.path),
      message: "Too many requests, please try again later.",
      standardHeaders: true,
      legacyHeaders: false,
    });

    // Static Files
    this.app.use(express.static(path.join(process.cwd(), "public")));

    // सिर्फ /api पर limiter
    this.app.use("/api", apiLimiter);
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true }));

    // Session
    this.app.use(
      session({
        secret: process.env.SESSION_SECRET!,
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: process.env.NODE_ENV === "production",
          httpOnly: true,
          sameSite: "strict",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
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
    windowMs: 15 * 60 * 1000, // 15 min window
    max: 10, // 10 requests per IP
    message: {
      success: false,
      message: "Too many requests, please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Only auth/login/reset पर ज़्यादा strict
  private readonly authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === "OPTIONS",
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

    // Other routes
    this.app.use("/api/userController", userRoutes);
    this.app.use("/api/products", productRoutes);
    this.app.use("/api/orders", orderRoutes);
    this.app.use("/api/cartController", cartRoutes);
    this.app.use("/api/reviews", reviewRoutes);
    this.app.use("/api/sellers", sellerRoutes);
    this.app.use("/api/marketplace", marketplaceRoutes);

    // Sensitive OTP/KYC
    this.app.use(
      "/api/ekycController",
      this.sensitiveLimiter, // चाहो तो यहाँ भी
      ipBlockerMiddleware,
      sensitiveSecurityMiddleware,
      otpRoutes,
    );

    // Swagger
    this.app.use(
      "/api-docs",
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec, {
        explorer: true,
        customSiteTitle: "E-Commerce API Docs",
      }),
    );

    // Health
    this.app.get("/", (req, res) => {
      res.json({
        message: "Vault Vogue Lite API ✅",
        version: "1.0.0",
        env: process.env.NODE_ENV,
      });
    });
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
      await mongoose.connect(MONGO_URI);
      this.logger.info("✅ MongoDB Connected");

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

  public getLogger(): winston.Logger {
    return this.logger;
  }

  // Graceful shutdown
  public async close(): Promise<void> {
    await mongoose.connection.close();
    this.logger.info("Server closed gracefully");
  }
}

export { Server };

const server = new Server();
const dbReady =
  mongoose.connection.readyState === 1 ? Promise.resolve() : server.connectDB();

export const serverHandler = async (req: Request, res: Response) => {
  try {
    await dbReady;
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
  process.on("SIGTERM", async () => {
    await server.close();
    process.exit(0);
  });

  await dbReady;
  server.listen();
}
