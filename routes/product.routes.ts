import express from "express";
import { Product } from "../models/Product.js";

const router = express.Router();

const normalizeDashboardPayload = (body: Record<string, any>) => ({
  ...body,
  bestseller: Boolean(body.bestseller),
  trending: Boolean(body.trending),
  details: body.details ?? {},
});

const getQueryString = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return undefined;
};

const parsePositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number.parseInt(getQueryString(value) ?? String(fallback), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const paginate = (
  pageValue: unknown,
  limitValue: unknown,
  fallbackPage: number,
  fallbackLimit: number,
) => {
  const page = parsePositiveInt(pageValue, fallbackPage);
  const limit = parsePositiveInt(limitValue, fallbackLimit);
  return { page, limit, skip: (page - 1) * limit };
};

const escapeRegex = (value: string) =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/g, "$&" as any);

const buildProductFilter = (query: Record<string, unknown>) => {
  const filter: Record<string, unknown> = {};
  const search = getQueryString(query.search)?.trim();

  if (search) {
    filter.$or = [
      { name: { $regex: escapeRegex(search), $options: "i" } },
      { description: { $regex: escapeRegex(search), $options: "i" } },
      { sku: { $regex: escapeRegex(search), $options: "i" } },
    ];
  }

  const bestseller = getQueryString(query.bestseller);
  if (bestseller === "true") filter.bestseller = true;
  if (bestseller === "false") filter.bestseller = false;

  const trending = getQueryString(query.trending);
  if (trending === "true") filter.trending = true;
  if (trending === "false") filter.trending = false;

  const isActive = getQueryString(query.isActive);
  if (isActive === "true") filter.isActive = true;
  if (isActive === "false") filter.isActive = false;

  const sellerId = getQueryString(query.sellerId);
  if (sellerId) filter.sellerId = sellerId;

  const subCategoryId = getQueryString(query.subCategoryId);
  if (subCategoryId) filter.subCategoryId = subCategoryId;

  const categoryId = getQueryString(query.categoryId);
  if (categoryId) filter.categoryIds = categoryId;

  return filter;
};

const buildSortOption = (query: Record<string, unknown>) => {
  const sortBy = getQueryString(query.sortBy);
  const order = getQueryString(query.order)?.toLowerCase();

  const allowedSortFields = new Set([
    "createdAt",
    "price",
    "name",
    "sku",
    "inventory.quantity",
  ]);

  const field = sortBy && allowedSortFields.has(sortBy) ? sortBy : "createdAt";
  const direction = order === "asc" ? 1 : -1;

  return { [field]: direction } as Record<string, 1 | -1>;
};

/**
 * @swagger
 * /api/products/getAll:
 *   get:
 *     summary: Get all products
 *     tags: [products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for paginated results
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
 *         description: Number of products per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search across name, description, or sku
 *       - in: query
 *         name: bestseller
 *         schema:
 *           type: boolean
 *         description: Filter by bestseller flag
 *       - in: query
 *         name: trending
 *         schema:
 *           type: boolean
 *         description: Filter by trending flag
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: sellerId
 *         schema:
 *           type: string
 *         description: Filter by seller ObjectId
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         description: Filter by category ObjectId
 *       - in: query
 *         name: subCategoryId
 *         schema:
 *           type: string
 *         description: Filter by sub-category ObjectId
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, price, name, inventory.quantity]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Products fetched successfully
 */
router.get("/getAll", async (req, res) => {
  const page = parsePositiveInt(req.query.page, 1);
  const limit = parsePositiveInt(req.query.limit, 10);
  const skip = (page - 1) * limit;

  const filter = buildProductFilter(req.query as Record<string, unknown>);
  const sort = buildSortOption(req.query as Record<string, unknown>);

  const [products, total] = await Promise.all([
    Product.find(filter).skip(skip).limit(limit).sort(sort),
    Product.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    message: "Products fetched successfully",
    data: products,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  });
});

/**
 * @swagger
 * /api/products/getbyId/{id}:
 *   get:
 *     summary: Get a product by id
 *     tags: [products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ObjectId
 *     responses:
 *       200:
 *         description: Product fetched successfully
 *       404:
 *         description: Product not found
 */

router.get("/getbyId/:id", async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }
  res.status(200).json({
    success: true,
    message: "Products fetched successfully",
    data: product,
  });
});

/**
 * @swagger
 * /api/products/create:
 *   post:
 *     summary: Create a product
 *     tags: [products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sellerId
 *               - name
 *               - price
 *               - categoryIds
 *               - images
 *             properties:
 *               sellerId:
 *                 type: string
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               sku:
 *                 type: string
 *               categoryIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               subCategoryId:
 *                 type: string
 *               inventory:
 *                 type: object
 *               images:
 *                 type: array
 *                 items:
 *                   type: object
 *               bestseller:
 *                 type: boolean
 *               trending:
 *                 type: boolean
 *               details:
 *                 type: object
 *     responses:
 *       201:
 *         description: Product created successfully
 *       400:
 *         description: Product not created
 */

router.post("/create", async (req, res) => {
  const product = await Product.create(normalizeDashboardPayload(req.body));
  if (!product) {
    return res.status(400).json({
      success: false,
      message: "Product not created",
    });
  }
  res.status(201).json({
    success: true,
    message: "Product created successfully",
    data: product,
  });
});

/**
 * @swagger
 * /api/products/dashboard:
 *   post:
 *     summary: Create a dashboard product
 *     tags: [products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sellerId
 *               - name
 *               - price
 *               - categoryIds
 *               - images
 *             properties:
 *               sellerId:
 *                 type: string
 *                 description: Seller ObjectId
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               sku:
 *                 type: string
 *               categoryIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               subCategoryId:
 *                 type: string
 *               inventory:
 *                 type: object
 *                 properties:
 *                   quantity:
 *                     type: number
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *               images:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                     isPrimary:
 *                       type: boolean
 *               bestseller:
 *                 type: boolean
 *               trending:
 *                 type: boolean
 *               details:
 *                 type: object
 *                 additionalProperties: true
 *     responses:
 *       201:
 *         description: Dashboard product created successfully
 */
router.post("/dashboard", async (req, res) => {
  const product = await Product.create(normalizeDashboardPayload(req.body));

  res.status(201).json({
    success: true,
    message: "Dashboard product created successfully",
    data: product,
  });
});

/**
 * @swagger
 * /api/products/dashboard:
 *   get:
 *     summary: Get dashboard product data
 *     tags: [products]
 *     parameters:
 *       - in: query
 *         name: recentPage
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number for recent products
 *       - in: query
 *         name: recentLimit
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page size for recent products
 *       - in: query
 *         name: bestsellerPage
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number for bestseller products
 *       - in: query
 *         name: bestsellerLimit
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page size for bestseller products
 *       - in: query
 *         name: trendingPage
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number for trending products
 *       - in: query
 *         name: trendingLimit
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page size for trending products
 *     responses:
 *       200:
 *         description: Dashboard data fetched successfully
 */
router.get("/dashboard", async (req, res) => {
  const recent = paginate(req.query.recentPage, req.query.recentLimit, 1, 10);
  const bestseller = paginate(
    req.query.bestsellerPage,
    req.query.bestsellerLimit,
    1,
    10,
  );
  const trending = paginate(
    req.query.trendingPage,
    req.query.trendingLimit,
    1,
    10,
  );

  const [
    totalProducts,
    activeProducts,
    bestsellerProducts,
    trendingProducts,
    recentProducts,
    lowStockProducts,
    bestsellerTotal,
    trendingTotal,
    lowStockTotal,
  ] = await Promise.all([
    Product.countDocuments({}),
    Product.countDocuments({ isActive: true }),
    Product.find({ bestseller: true })
      .sort({ createdAt: -1 })
      .skip(bestseller.skip)
      .limit(bestseller.limit),
    Product.find({ trending: true })
      .sort({ createdAt: -1 })
      .skip(trending.skip)
      .limit(trending.limit),
    Product.find({})
      .sort({ createdAt: -1 })
      .skip(recent.skip)
      .limit(recent.limit),
    Product.find({ "inventory.quantity": { $lte: 10 } })
      .sort({ "inventory.quantity": 1, createdAt: -1 })
      .limit(20),
    Product.countDocuments({ bestseller: true }),
    Product.countDocuments({ trending: true }),
    Product.countDocuments({ "inventory.quantity": { $lte: 10 } }),
  ]);

  res.status(200).json({
    success: true,
    message: "Dashboard data fetched successfully",
    data: {
      summary: {
        totalProducts,
        activeProducts,
        bestsellerProducts: bestsellerTotal,
        trendingProducts: trendingTotal,
        lowStockProducts: lowStockTotal,
      },
      highlights: {
        bestsellerProducts,
        trendingProducts,
        recentProducts,
        lowStockProducts,
        pagination: {
          recent: {
            page: recent.page,
            limit: recent.limit,
            total: totalProducts,
            totalPages: Math.ceil(totalProducts / recent.limit),
          },
          bestseller: {
            page: bestseller.page,
            limit: bestseller.limit,
            total: bestsellerTotal,
            totalPages: Math.ceil(bestsellerTotal / bestseller.limit),
          },
          trending: {
            page: trending.page,
            limit: trending.limit,
            total: trendingTotal,
            totalPages: Math.ceil(trendingTotal / trending.limit),
          },
        },
      },
    },
  });
});

/**
 * @swagger
 * /api/products/dashboard/{id}:
 *   patch:
 *     summary: Update a dashboard product
 *     tags: [products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ObjectId
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sellerId:
 *                 type: string
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               sku:
 *                 type: string
 *               categoryIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               subCategoryId:
 *                 type: string
 *               inventory:
 *                 type: object
 *                 properties:
 *                   quantity:
 *                     type: number
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *               images:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                     isPrimary:
 *                       type: boolean
 *               bestseller:
 *                 type: boolean
 *               trending:
 *                 type: boolean
 *               details:
 *                 type: object
 *                 additionalProperties: true
 *     responses:
 *       200:
 *         description: Dashboard product updated successfully
 *       404:
 *         description: Product not found
 */
router.patch("/dashboard/:id", async (req, res) => {
  const { id } = req.params;
  const update = normalizeDashboardPayload(req.body);

  const product = await Product.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  });

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  res.status(200).json({
    success: true,
    message: "Dashboard product updated successfully",
    data: product,
  });
});

export default router;
