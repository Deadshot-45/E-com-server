// import cors from "cors";
// import dotenv from "dotenv";
// import express, { NextFunction, Request, Response } from "express";
// import rateLimit from "express-rate-limit";
// import session from "express-session";
// import mongoose from "mongoose";
// import swaggerUi from "swagger-ui-express";
// // validationResult from express-validator removed due to vulnerable transitive dependency (validator)
// import helmet from "helmet";
// import winston from "winston";

// // Import Routes
// import { globalErrorHandler } from "./middleware/errorMiddleware.js";
// import cartRoutes from "./routes/cart.routes.js";
// import marketplaceRoutes from "./routes/marketplaceRoutes.js";
// import orderRoutes from "./routes/order.routes.js";
// import otpRoutes from "./routes/otp.routes.js";
// import productRoutes from "./routes/product.routes.js";
// import reviewRoutes from "./routes/review.routes.js";
// import sellerRoutes from "./routes/seller.routes.js";
// import sellerAuthRoutes from "./routes/sellerRoutes.js";
// import userRoutes from "./routes/user.routes.js";
// import AppError from "./utils/AppError.js";
// import { swaggerSpec } from "./utils/swagger.js";

// dotenv.config();

// // Configure logger for serverless environment
// const logger = winston.createLogger({
//   level: process.env.NODE_ENV === "production" ? "info" : "debug",
//   format: winston.format.combine(
//     winston.format.timestamp(),
//     winston.format.json(),
//   ),
//   transports: [
//     new winston.transports.Console({
//       format: winston.format.simple(),
//     }),
//   ],
// });

// const app = (express as any)();

// // Set Express to trust proxy headers (like X-Forwarded-For) since the app is deployed on Vercel.
// // This is necessary for express-rate-limit to function correctly.
// app.set("trust proxy", 1);
// // Security middleware - CSP disabled for API server to allow cross-origin requests
// app.use(
//   helmet({
//     contentSecurityPolicy: false, // Disable CSP for API server
//     crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin requests
//     crossOriginEmbedderPolicy: false, // Allow cross-origin embedding
//   }),
// );

// // CORS configuration - MUST be before rate limiting to handle preflight requests
// const allowedOrigins = [
//   "https://vogue-vault-blue.vercel.app",
//   "http://localhost:5173",
//   "https://vault-vogue-expressjs.vercel.app",
// ];

// const corsOptionsDelegate = function (req: Request, callback: any) {
//   const origin = req.headers.origin;
//   let corsOptions;
//   // Check if origin is in whitelist (case-insensitive, handle undefined)
//   if (
//     origin &&
//     allowedOrigins.some(
//       (allowed) => allowed.toLowerCase() === origin.toLowerCase(),
//     )
//   ) {
//     corsOptions = {
//       origin: true, // Reflect the requested origin in the CORS response
//       credentials: true,
//       methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
//       allowedHeaders: [
//         "Content-Type",
//         "Authorization",
//         "X-Requested-With",
//         "Accept",
//         "Origin",
//         "Cookie", // Allow cookies
//       ],
//       exposedHeaders: ["Content-Range", "X-Content-Range"],
//       maxAge: 86400,
//       preflightContinue: false,
//       optionsSuccessStatus: 204,
//     };
//     // Log CORS success in development
//     if (process.env.NODE_ENV !== "production") {
//       logger.debug(`CORS allowed for origin: ${origin}`);
//     }
//   } else {
//     corsOptions = { origin: false }; // disable CORS for this request
//     if (process.env.NODE_ENV !== "production") {
//       logger.warn(`CORS blocked for origin: ${origin || "undefined"}`);
//     }
//   }
//   callback(null, corsOptions); // callback expects two parameters: error and options
// };

// // Apply CORS middleware FIRST (before rate limiting)
// app.use(cors(corsOptionsDelegate));

// // Rate limiting - skip for OPTIONS (preflight) requests
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: process.env.NODE_ENV === "production" ? 100 : 1000,
//   message: "Too many requests from this IP, please try again later.",
//   skip: (req: Request) => req.method === "OPTIONS", // Skip rate limiting for preflight requests
// });

// app.use(limiter);
// app.use(express.static("public"));
// app.use(express.json({ limit: "10mb" }));

// // Request logging middleware
// app.use((req: Request, res: Response, next: NextFunction) => {
//   logger.info(
//     `${req.method} ${req.url} - Origin: ${req.headers.origin || "none"}`,
//   );
//   next();
// });

// // Request validation middleware (no-op)
// // express-validator was removed because it pulls in a vulnerable `validator` version.
// // If you need request validation, replace with a safer library (e.g. joi) or add custom checks.
// const validateRequest = (req: Request, res: Response, next: NextFunction) =>
//   next();

// const MONGO_URI =
//   process.env.MONGO_URI || "mongodb://localhost:27017/vault-vogue-lite";
// const PORT = process.env.PORT || 3000;

// // Middleware
// app.use((cors as any)());
// app.use((express as any).json());
// app.use((express as any).urlencoded({ extended: true }));

// // Session middleware
// app.use(
//   session({
//     secret:
//       process.env.SESSION_SECRET || "your-super-secret-key-change-in-prod",
//     resave: false, // Don't save unchanged sessions
//     saveUninitialized: false, // Don't create sessions for unauth users
//     cookie: {
//       secure: process.env.NODE_ENV === "production", // HTTPS only in prod
//       httpOnly: true, // Prevent JS access
//       sameSite: "lax", // CSRF protection
//       maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
//     },
//   }),
// );

// // Graceful shutdown
// process.on("SIGTERM", async () => {
//   console.log("SIGTERM received, closing DB connection...");
//   await mongoose.connection.close();
//   process.exit(0);
// });

// // Top-level database connection
// async function startServer() {
//   try {
//     // Connect to MongoDB
//     await mongoose.connect(MONGO_URI);
//     console.log("✅ MongoDB Connected:", mongoose.connection.name);

//     // Connection events
//     mongoose.connection.on("error", (err) => {
//       console.error("❌ MongoDB error:", err);
//     });

//     mongoose.connection.on("disconnected", () => {
//       console.log("⚠️ MongoDB disconnected");
//     });

//     // Start server
//     app.listen(PORT, () => {
//       console.log(`🚀 Server running on port ${PORT}`);
//     });
//   } catch (error) {
//     console.error("❌ Failed to start server:", error);
//     process.exit(1);
//   }
// }

// // Routes
// app.use("/api/users", validateRequest, userRoutes);
// app.use("/api/products", validateRequest, productRoutes);
// app.use("/api/orders", validateRequest, orderRoutes);
// app.use("/api/cart", validateRequest, cartRoutes);
// app.use("/api/reviews", validateRequest, reviewRoutes);
// app.use("/api/sellers", validateRequest, sellerRoutes);
// app.use("/api/auth/seller", validateRequest, sellerAuthRoutes);
// app.use("/api/marketplace", validateRequest, marketplaceRoutes);
// app.use("/api/ekyc", validateRequest, otpRoutes);

// // Swagger Documentation Route
// app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// // Root route
// app.get("/", (req: any, res: any) => {
//   res.send("Vault Vogue Lite Server API is running...");
// });

// // Unhandled Routes (404)
// app.use((req: Request, res: Response, next: NextFunction) => {
//   next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
// });

// // Global Error Handler Middleware
// app.use(globalErrorHandler);

// await startServer();
// export default app;

import cors from "cors";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import session from "express-session";
import helmet from "helmet";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import swaggerUi from "swagger-ui-express";
import winston from "winston";

// Middleware & Utils
import { globalErrorHandler } from "./middleware/errorMiddleware.js";
import AppError from "./utils/AppError.js";
import { swaggerSpec } from "./utils/swagger.js";

// Routes
import cartRoutes from "./routes/cart.routes.js";
import marketplaceRoutes from "./routes/marketplaceRoutes.js";
import orderRoutes from "./routes/order.routes.js";
import otpRoutes from "./routes/otp.routes.js";
import productRoutes from "./routes/product.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import sellerRoutes from "./routes/seller.routes.js";
import sellerAuthRoutes from "./routes/sellerRoutes.js";
import userRoutes from "./routes/user.routes.js";

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
    this.app.set("trust proxy", 1);

    // Security
    this.app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" },
      }),
    );

    // CORS
    const allowedOrigins = [
      "https://vogue-vault-blue.vercel.app",
      "http://localhost:5173",
      "https://vault-vogue-expressjs.vercel.app",
    ];

    this.app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin || allowedOrigins.includes(origin)) {
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
    this.app.use(
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: process.env.NODE_ENV === "production" ? 100 : 1000,
        skip: (req) => req.method === "OPTIONS",
        message: "Too many requests, please try again later.",
      }),
    );

    // Body parsing
    this.app.use(express.static("public"));
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true }));

    // Session
    this.app.use(
      session({
        secret:
          process.env.SESSION_SECRET || "your-super-secret-key-change-in-prod",
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: process.env.NODE_ENV === "production",
          httpOnly: true,
          sameSite: "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        },
      }),
    );

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      this.logger.info(`${req.method} ${req.url} [${req.ip}]`);
      next();
    });
  }

  private routes(): void {
    // API Routes
    this.app.use("/api/users", userRoutes);
    this.app.use("/api/products", productRoutes);
    this.app.use("/api/orders", orderRoutes);
    this.app.use("/api/cart", cartRoutes);
    this.app.use("/api/reviews", reviewRoutes);
    this.app.use("/api/sellers", sellerRoutes);
    this.app.use("/api/auth/seller", sellerAuthRoutes);
    this.app.use("/api/marketplace", marketplaceRoutes);
    this.app.use("/api/otp", otpRoutes);

    // Docs
    this.app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

    // Health check
    this.app.get("/", (req, res) => {
      res.json({
        message: "Vault Vogue Lite API ✅",
        version: "1.0.0",
        env: process.env.NODE_ENV,
      });
    });
  }

  private errorHandlers(): void {
    // 404 handler
    this.app.use(
      "/*splat",
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
