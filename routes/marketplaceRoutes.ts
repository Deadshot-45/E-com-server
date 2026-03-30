import express from "express";
import { sellerAuthMiddleware } from "../middleware/sellerAuthMiddleware.js";
import MarketplaceService from "../services/MarketplaceService.js";

const router = express.Router();

// Add product (seller-only)
router.post("/add-product", sellerAuthMiddleware, async (req, res) => {
  try {
    const product = await MarketplaceService.addProductForSeller((req as any).seller._id, req.body);
    res.json({ success: true, product });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// List seller's products
router.get("/my-products", sellerAuthMiddleware, async (req, res) => {
  const products = await MarketplaceService.listProductsForSeller((req as any).seller._id);
  res.json({ success: true, products });
});

// List all sellers for a product
router.get("/product-sellers/:productId", async (req, res) => {
  const sellers = await MarketplaceService.listSellersForProduct(req.params.productId);
  res.json({ success: true, sellers });
});

// Place order (transactional)
router.post("/place-order", async (req, res) => {
  try {
    const result = await MarketplaceService.placeOrder(req.body.items);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Cancel order
router.post("/cancel-order", async (req, res) => {
  try {
    const result = await MarketplaceService.cancelOrder(req.body.items);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Update seller rating
router.post("/update-rating/:sellerId", async (req, res) => {
  try {
    const rating = await MarketplaceService.updateSellerRating(req.params.sellerId, req.body.rating);
    res.json({ success: true, averageRating: rating });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
