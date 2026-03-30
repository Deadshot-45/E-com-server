import cors from "cors";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import session from "express-session";
import mongoose from "mongoose";
import swaggerUi from "swagger-ui-express";

// Import Routes
import { globalErrorHandler } from "./middleware/errorMiddleware.js";
import cartRoutes from "./routes/cart.routes.js";
import marketplaceRoutes from "./routes/marketplaceRoutes.js";
import orderRoutes from "./routes/order.routes.js";
import otpRoutes from "./routes/otp.routes.js";
import productRoutes from "./routes/product.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import sellerRoutes from "./routes/seller.routes.js";
import sellerAuthRoutes from "./routes/sellerRoutes.js";
import userRoutes from "./routes/user.routes.js";
import AppError from "./utils/AppError.js";
import { swaggerSpec } from "./utils/swagger.js";

dotenv.config();

const app = (express as any)();
const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/vault-vogue-lite";

// Middleware
app.use((cors as any)());
app.use((express as any).json());
app.use((express as any).urlencoded({ extended: true }));

// Session middleware
app.use(
  session({
    secret:
      process.env.SESSION_SECRET || "your-super-secret-key-change-in-prod",
    resave: false, // Don't save unchanged sessions
    saveUninitialized: false, // Don't create sessions for unauth users
    cookie: {
      secure: process.env.NODE_ENV === "production", // HTTPS only in prod
      httpOnly: true, // Prevent JS access
      sameSite: "lax", // CSRF protection
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  }),
);

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing DB connection...");
  await mongoose.connection.close();
  process.exit(0);
});

// Top-level database connection
async function startServer() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB Connected:", mongoose.connection.name);

    // Connection events
    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("⚠️ MongoDB disconnected");
    });

    // Start server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Routes
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/sellers", sellerRoutes);
app.use("/api/auth/seller", sellerAuthRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/otp", otpRoutes);

// Swagger Documentation Route
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Root route
app.get("/", (req: any, res: any) => {
  res.send("Vault Vogue Lite Server API is running...");
});

// Unhandled Routes (404)
app.use((req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handler Middleware
app.use(globalErrorHandler);

await startServer();
export default app;
