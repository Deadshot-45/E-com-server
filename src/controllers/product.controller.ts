import { Request, Response, NextFunction } from "express";
import { Product } from "../models/Product";
import { ProductVariant } from "../models/ProductVariant";
import { Inventory } from "../models/Inventory";
import { saveProductWithVariants } from "../services/product.service";
import mongoose from "mongoose";
import { Category } from "../models/Category";

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
      minPrice,
      maxPrice,
      isNew,
      sortBy = "createdAt",
      order = "desc",
    } = req.query as Record<string, string>;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 10, 1);
    const skip = (pageNum - 1) * limitNum;

    const match: any = {};

    /**
     * ✅ BASE FILTERS
     */
    match.isActive = isActive !== undefined ? isActive === "true" : true;

    /**
     * ✅ CATEGORY (slug OR ObjectId)
     */
    if (categoryId) {
      let categoryObjectId = null;

      if (mongoose.Types.ObjectId.isValid(categoryId)) {
        categoryObjectId = new mongoose.Types.ObjectId(categoryId);
      } else {
        const category = await Category.findOne({
          slug: categoryId.toLowerCase(),
        }).select("_id");

        if (category) categoryObjectId = category._id;
      }

      if (categoryObjectId) {
        match.categoryIds = { $in: [categoryObjectId] };
      }
    }

    /**
     * ✅ SUB CATEGORY
     */
    if (subCategoryId && mongoose.Types.ObjectId.isValid(subCategoryId)) {
      match.subCategoryId = new mongoose.Types.ObjectId(subCategoryId);
    }

    /**
     * ✅ SELLER
     */
    if (sellerId && mongoose.Types.ObjectId.isValid(sellerId)) {
      match.sellerId = new mongoose.Types.ObjectId(sellerId);
    }

    /**
     * ✅ FLAGS
     */
    if (bestseller === "true") match.bestseller = true;
    if (trending === "true") match.trending = true;

    /**
     * ✅ NEW PRODUCTS (7 days)
     */
    if (isNew === "true") {
      match.createdAt = {
        $gte: new Date(Date.now() - 7 * 86400000),
      };
    }

    const pipeline: any[] = [];

    /**
     * ✅ BASE MATCH
     */
    pipeline.push({ $match: match });

    /**
     * ✅ SEARCH
     */
    if (search && search.trim()) {
      match.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        {
          "variants.attributes.size": { $regex: search.trim(), $options: "i" },
        },
      ];
    }

    /**
     * ✅ VARIANTS JOIN
     */
    pipeline.push({
      $lookup: {
        from: "productvariants",
        localField: "_id",
        foreignField: "productId",
        as: "variants",
      },
    });

    /**
     * ✅ PRICE DERIVATION
     */
    pipeline.push({
      $addFields: {
        minPrice: { $min: "$variants.price" },
        maxPrice: { $max: "$variants.price" },
      },
    });

    /**
     * ✅ PRICE FILTER (FIXED)
     */
    if (minPrice || maxPrice) {
      const priceFilter: any = {};

      if (minPrice) priceFilter.$gte = Number(minPrice);
      if (maxPrice) priceFilter.$lte = Number(maxPrice);

      pipeline.push({
        $match: {
          minPrice: priceFilter,
        },
      });
    }

    /**
     * ✅ INVENTORY JOIN (OPTIMIZED)
     */
    pipeline.push({
      $lookup: {
        from: "inventories",
        let: { variantIds: "$variants._id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $in: ["$variantId", "$$variantIds"],
              },
            },
          },
        ],
        as: "inventoryItems",
      },
    });

    /**
     * ✅ SORT IMAGES
     */
    pipeline.push({
      $addFields: {
        images: {
          $sortArray: {
            input: "$images",
            sortBy: { isPrimary: -1 },
          },
        },
      },
    });

    /**
     * ✅ CATEGORY JOIN
     */
    pipeline.push({
      $lookup: {
        from: "categoryIds",
        localField: "categoryIds",
        foreignField: "_id",
        as: "categories",
      },
    });

    /**
     * ✅ SUBCATEGORY JOIN
     */
    pipeline.push({
      $lookup: {
        from: "categories",
        localField: "subCategoryId",
        foreignField: "_id",
        as: "subCategory",
      },
    });

    pipeline.push({
      $lookup: {
        from: "categories",
        let: { catIds: "$categoryIds" },
        pipeline: [
          { $match: { $expr: { $in: ["$_id", "$$catIds"] } } },
          { $project: { name: 1, slug: 1 } },
        ],
        as: "categories",
      },
    });

    /**
     * ✅ FLATTEN SUBCATEGORY
     */
    pipeline.push({
      $addFields: {
        subCategory: { $arrayElemAt: ["$subCategory", 0] },
      },
    });

    /**
     * ✅ SORTING
     */
    const sortMap: any = {
      createdAt: "createdAt",
      name: "name",
      price: "minPrice",
    };

    const sortField = sortMap[sortBy] || "createdAt";
    const sortOrder = order === "asc" ? 1 : -1;

    pipeline.push({
      $sort: { [sortField]: sortOrder },
    });

    /**
     * ✅ PAGINATION + COUNT
     */
    pipeline.push({
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limitNum },

          {
            $project: {
              name: 1,
              images: 1,
              bestseller: 1,
              trending: 1,
              createdAt: 1,
              sellerId: 1,

              // ✅ CATEGORY FOR FRONTEND
              categories: {
                $map: {
                  input: "$categories",
                  as: "cat",
                  in: {
                    _id: "$$cat._id",
                    name: "$$cat.name",
                    slug: "$$cat.slug",
                  },
                },
              },

              // ✅ SUBCATEGORY
              subCategory: {
                _id: "$subCategory._id",
                name: "$subCategory.name",
                slug: "$subCategory.slug",
              },

              sizes: {
                $map: {
                  input: "$variants",
                  as: "variant",
                  in: {
                    variantId: "$$variant._id",
                    size: {
                      $ifNull: ["$$variant.attributes.size", ""],
                    },
                    price: "$$variant.price",
                    compareAtPrice: "$$variant.compareAtPrice",

                    stock: {
                      $let: {
                        vars: {
                          inventoryItem: {
                            $first: {
                              $filter: {
                                input: "$inventoryItems",
                                as: "inv",
                                cond: {
                                  $eq: ["$$inv.variantId", "$$variant._id"],
                                },
                              },
                            },
                          },
                        },
                        in: {
                          $ifNull: ["$$inventoryItem.stock", 0],
                        },
                      },
                    },
                  },
                },
              },

              minPrice: 1,
              maxPrice: 1,
            },
          },
        ],

        totalCount: [{ $count: "count" }],
      },
    });

    /**
     * ✅ EXECUTE
     */
    const result = await Product.aggregate(pipeline);

    const data = result[0]?.data || [];
    const total = result[0]?.totalCount[0]?.count || 0;

    return res.status(200).json({
      success: true,
      data,
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
    const rawId = req.params.id;

    // ✅ Type safety
    if (!rawId || Array.isArray(rawId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid id format",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(rawId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ObjectId",
      });
    }

    const objectId = new mongoose.Types.ObjectId(rawId);

    // const data = await Product.find();
    // console.log(data);
    console.log("PARAM ID:", rawId);

    const all = await Product.find().select("_id");
    console.log(
      "ALL IDS:",
      all.map((p) => p._id.toString()),
    );
    const result = await Product.aggregate([
      {
        $match: {
          _id: objectId,
        },
      },

      // 🔥 VARIANTS JOIN
      {
        $lookup: {
          from: "productvariants",
          let: { productId: "$_id" },
          pipeline: [
            {
              $match: {
                isActive: true,
                $expr: { $eq: ["$productId", "$$productId"] },
              },
            },

            // ✅ ADD THIS
            {
              $addFields: {
                variantId: { $toString: "$_id" },
              },
            },

            // 🔥 INVENTORY JOIN
            {
              $lookup: {
                from: "inventories",
                localField: "_id",
                foreignField: "variantId",
                as: "inventory",
              },
            },

            {
              $addFields: {
                inventory: { $arrayElemAt: ["$inventory", 0] },
              },
            },

            {
              $addFields: {
                stock: { $ifNull: ["$inventory.stock", 0] },
                reserved: { $ifNull: ["$inventory.reserved", 0] },
                sold: { $ifNull: ["$inventory.sold", 0] },
                availableStock: {
                  $subtract: [
                    { $ifNull: ["$inventory.stock", 0] },
                    { $ifNull: ["$inventory.reserved", 0] },
                  ],
                },
                isOutOfStock: {
                  $lte: [{ $ifNull: ["$inventory.stock", 0] }, 0],
                },
              },
            },

            {
              $project: {
                inventory: 0,
              },
            },
          ],
          as: "variants",
        },
      },

      // 🔥 Sort images (primary first)
      {
        $addFields: {
          images: {
            $sortArray: {
              input: "$images",
              sortBy: { isPrimary: -1 },
            },
          },
        },
      },

      // 🔥 Price range
      {
        $addFields: {
          minPrice: { $ifNull: [{ $min: "$variants.price" }, 0] },
          maxPrice: { $ifNull: [{ $max: "$variants.price" }, 0] },
        },
      },

      // 🔥 Clean response
      {
        $project: {
          __v: 0,
        },
      },
    ]);

    if (!result.length) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.json({
      success: true,
      data: result[0],
    });
  } catch (err) {
    next(err);
  }
};
