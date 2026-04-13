import { Request, Response, NextFunction } from "express";
import { Product } from "../models/Product";
import { Category } from "../models/Category";

export const getLandingPage = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const NEW_DAYS = 7;
    const newDate = new Date(Date.now() - NEW_DAYS * 24 * 60 * 60 * 1000);

    /**
     * ⚡ PARALLEL QUERIES (IMPORTANT)
     */
    const [banners, categories, newArrivals, trending, bestsellers, featured] =
      await Promise.all([
        /**
         * 🎯 HERO BANNERS (STATIC / CMS / DB)
         */
        Promise.resolve([
          {
            title: "Big Summer Sale",
            image: "/banners/sale.jpg",
            link: "/sale",
          },
          {
            title: "New Arrivals",
            image: "/banners/new.jpg",
            link: "/new",
          },
        ]),

        /**
         * 🧭 CATEGORIES
         */
        Category.find({ isActive: true })
          .limit(8)
          .select("name slug image")
          .lean(),

        /**
         * 🆕 NEW ARRIVALS
         */
        Product.find({
          isActive: true,
          createdAt: { $gte: newDate },
        })
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),

        /**
         * 📈 TRENDING
         */
        Product.find({
          isActive: true,
          trending: true,
        })
          .limit(10)
          .lean(),

        /**
         * 🏆 BESTSELLERS
         */
        Product.find({
          isActive: true,
          bestseller: true,
        })
          .limit(10)
          .lean(),

        /**
         * ⭐ FEATURED (fallback strategy)
         */
        Product.find({
          isActive: true,
        })
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
      ]);

    res.json({
      success: true,
      data: {
        banners,
        categories,
        sections: {
          newArrivals,
          trending,
          bestsellers,
          featured,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};
