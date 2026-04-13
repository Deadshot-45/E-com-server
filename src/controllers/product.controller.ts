import { Request, Response, NextFunction } from "express";
import { Product } from "../models/Product";
import { ProductVariant } from "../models/ProductVariant";
import { Inventory } from "../models/Inventory";
import { saveProductWithVariants } from "../services/product.service";

/**
 * CREATE PRODUCT
 */
export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const product = await saveProductWithVariants(req.body);

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET PRODUCTS (FILTER + SEARCH + PAGINATION)
 */
export const getProducts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      page = "1",
      limit = "10",
      search,
      categoryId,
      subCategoryId,
      sellerId,
      bestseller,
      trending,
      isActive,
      sortBy = "createdAt",
      order = "desc",
    } = req.query as Record<string, string>;

    const pageNum = Math.max(parseInt(page), 1);
    const limitNum = Math.max(parseInt(limit), 1);
    const skip = (pageNum - 1) * limitNum;

    /**
     * FILTER
     */
    const filter: any = {};

    if (search) {
      filter.$text = { $search: search };
    }

    if (categoryId) filter.categoryIds = categoryId;
    if (subCategoryId) filter.subCategoryId = subCategoryId;
    if (sellerId) filter.sellerId = sellerId;

    if (bestseller === "true") filter.bestseller = true;
    if (trending === "true") filter.trending = true;
    if (isActive === "true") filter.isActive = true;

    /**
     * SORT
     */
    const allowedSort = ["createdAt", "name"];
    const sortField = allowedSort.includes(sortBy) ? sortBy : "createdAt";
    const sortOrder = order === "asc" ? 1 : -1;

    const sort: Record<string, 1 | -1> = {
      [sortField]: sortOrder,
    };

    /**
     * QUERY
     */
    const [products, total] = await Promise.all([
      Product.find(filter).sort(sort).skip(skip).limit(limitNum).lean(),

      Product.countDocuments(filter),
    ]);

    const NEW_DAYS = 7;

    filter.createdAt = {
      $gte: new Date(Date.now() - NEW_DAYS * 24 * 60 * 60 * 1000),
    };

    const { minPrice, maxPrice } = req.query;

    if (minPrice || maxPrice) {
      const variantIds = await ProductVariant.find({
        price: {
          ...(minPrice && { $gte: Number(minPrice) }),
          ...(maxPrice && { $lte: Number(maxPrice) }),
        },
      }).distinct("productId");

      filter._id = { $in: variantIds };
    }

    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasNextPage: pageNum * limitNum < total,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET PRODUCT BY ID (WITH VARIANTS + STOCK)
 */
export const getProductById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const productId = req.params.id;

    const product = await Product.findById(productId).lean();
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const variants = await ProductVariant.find({
      productId,
      isActive: true,
    }).lean();

    const inventory = await Inventory.find({
      variantId: { $in: variants.map((v) => v._id) },
    }).lean();

    const stockMap = new Map<string, number>(
      inventory.map((i) => [String(i.variantId), i.stock]),
    );

    const enrichedVariants = variants.map((v) => ({
      ...v,
      stock: stockMap.get(String(v._id)) ?? 0,
    }));

    res.json({
      success: true,
      data: {
        ...product,
        variants: enrichedVariants,
      },
    });
  } catch (err) {
    next(err);
  }
};
