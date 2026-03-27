import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";

// Import Routes
import cartRoutes from "./routes/cart.routes.js";
import marketplaceRoutes from "./routes/marketplaceRoutes.js";
import orderRoutes from "./routes/order.routes.js";
import productRoutes from "./routes/product.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import sellerRoutes from "./routes/seller.routes.js";
import sellerAuthRoutes from "./routes/sellerRoutes.js";
import userRoutes from "./routes/user.routes.js";

dotenv.config();

const app = (express as any)();
const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/vault-vogue-lite";

// Middleware
app.use((cors as any)());
app.use((express as any).json());
app.use((express as any).urlencoded({ extended: true }));

// Database Connection
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB Database Connected..."))
  .catch((err) => console.log("MongoDB Connection Error:", err));

// Routes
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/sellers", sellerRoutes);
app.use("/api/auth/seller", sellerAuthRoutes);
app.use("/api/marketplace", marketplaceRoutes);

// Root route
app.get("/", (req: any, res: any) => {
  res.send("Vault Vogue Lite Server API is running...");
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
