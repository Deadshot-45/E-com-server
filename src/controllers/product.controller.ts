import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import { Product } from "../models/Product.js";
import { ProductVariant } from "../models/ProductVariant.js";
import { Inventory } from "../models/Inventory.js";
import { Category } from "../models/Category.js";
import { saveProductWithVariants } from "../services/product.service.js";
import Upload from "../models/Upload.js";

/**
 * CREATE PRODUCT
 */
export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let { category, variants, id, productId, ...rest } = req.body;
    let categoryIds: mongoose.Types.ObjectId[] = [];

    // Auto-detect gender/target category based on name and category info
    const lowerName = rest.name?.toLowerCase() || "";
    let targetGender = "";

    if (
      lowerName.includes("women") ||
      lowerName.includes("girl") ||
      lowerName.includes("female") ||
      lowerName.includes("lady") ||
      lowerName.includes("ladies") ||
      lowerName.includes("she") ||
      lowerName.includes("her") ||
      lowerName.includes("girls")
    ) {
      targetGender = (lowerName.includes("girl") || lowerName.includes("baby")) ? "Kids" : "Women";
    } else if (
      lowerName.includes("men") ||
      lowerName.includes("boy") ||
      lowerName.includes("male") ||
      lowerName.includes("guy") ||
      lowerName.includes("gentleman") ||
      lowerName.includes("his") ||
      lowerName.includes("boys")
    ) {
      targetGender = (lowerName.includes("boy") || lowerName.includes("baby")) ? "Kids" : "Men";
    } else if (
      lowerName.includes("kid") ||
      lowerName.includes("baby") ||
      lowerName.includes("child") ||
      lowerName.includes("toddler")
    ) {
      targetGender = "Kids";
    } else {
      // Default fallback
      targetGender = "Women";
    }

    if (targetGender) {
      const genderCat = await Category.findOne({
        name: { $regex: new RegExp(`^${targetGender}$`, "i") },
      });
      if (genderCat) {
        categoryIds.push(genderCat._id as mongoose.Types.ObjectId);
      }
    }

    const targetProductId = productId || id;

    // Build variants
    if (!variants || variants.length === 0) {
      variants = [
        {
          sku: rest.sku || `VV-SL-${Math.floor(1000 + Math.random() * 9000)}`,
          price: Number(rest.price),
          stock: Number(rest.stock) || 10,
          images: rest.images || (rest.image ? [{ url: rest.image, isPrimary: true }] : []),
          attributes: {
            size: "",
            color: "",
          },
        },
      ];
    } else {
      // Map variants from frontend schema to backend schema
      variants = variants.map((v: any) => ({
        sku: v.sku || `VV-SL-${Math.floor(1000 + Math.random() * 9000)}`,
        price: Number(v.price) || Number(rest.price),
        stock: Number(v.stock) || 0,
        images: v.images || [],
        attributes: {
          size: v.size || "",
          color: v.color || "",
        },
      }));
    }

    const payload = {
      ...rest,
      category,
      categoryIds,
      variants,
    };

    const product = await saveProductWithVariants(payload, targetProductId);

    res.status(targetProductId ? 200 : 201).json({
      success: true,
      message: targetProductId ? "Product updated successfully" : "Product created successfully",
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
      categoryName,
      sellerId,
      bestseller,
      trending,
      isActive,
      minPrice,
      maxPrice,
      isNew,
      isSale,
      sortBy = "createdAt",
      order = "desc",
    } = req.query as Record<string, string>;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 10, 1);
    const skip = (pageNum - 1) * limitNum;

    const match: any = {};

    /**
     * ✅ BASE FILTERS
     * isActive=all  → no filter (seller sees everything: active + draft)
     * isActive=true → only active products (customer-facing, default)
     * isActive=false → only draft products
     */
    if (isActive === "all") {
      // no filter — return all regardless of status
    } else {
      match.isActive = isActive !== undefined ? isActive === "true" : true;
    }

    /**
     * ✅ SEARCH — must be added BEFORE pipeline.push($match)
     */
    if (search && search.trim()) {
      match.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        { description: { $regex: search.trim(), $options: "i" } },
      ];
    }

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
        match.categoryIds = { $all: [categoryObjectId] };
      }
    }

    if (categoryName && categoryName !== "All") {
      const cat = await Category.findOne({
        name: { $regex: new RegExp(`^${categoryName}$`, "i") },
      }).select("_id");

      if (cat) {
        if (match.categoryIds && match.categoryIds.$all) {
          match.categoryIds.$all.push(cat._id);
        } else {
          match.categoryIds = { $all: [cat._id] };
        }
      } else {
        // If category is not found in database, force match to fail so 0 items are returned
        match.categoryIds = { $all: [new mongoose.Types.ObjectId()] };
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
     * ✅ BASE MATCH (search already included)
     */
    pipeline.push({ $match: match });

    /**
     * ✅ VARIANTS JOIN — each size+color combination is a variant document
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
     * ✅ PRICE DERIVATION from variants
     */
    pipeline.push({
      $addFields: {
        minPrice: { $min: "$variants.price" },
        maxPrice: { $max: "$variants.price" },
      },
    });

    /**
     * ✅ PRICE FILTER
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
     * ✅ SALE FILTER
     */
    if (isSale === "true") {
      pipeline.push({
        $match: {
          $expr: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: "$variants",
                    as: "v",
                    cond: {
                      $gt: ["$$v.compareAtPrice", "$$v.price"],
                    },
                  },
                },
              },
              0,
            ],
          },
        },
      });
    }

    /**
     * ✅ INVENTORY JOIN — stock per variant
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
     * ✅ IMAGES — aggregate all images from all variants (primary first)
     * Each color/size variant carries its own images array
     */
    pipeline.push({
      $addFields: {
        images: {
          $reduce: {
            input: "$variants",
            initialValue: [],
            in: { $concatArrays: ["$$value", "$$this.images"] }
          }
        }
      }
    });

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
     * ✅ SUBCATEGORY JOIN
     */
    pipeline.push({
      $lookup: {
        from: "subcategories",
        localField: "subCategoryId",
        foreignField: "_id",
        as: "subCategoryArr",
      },
    });
    
    pipeline.push({
      $addFields: {
        subCategory: { $arrayElemAt: ["$subCategoryArr", 0] },
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
              category: 1,
              description: 1,
              images: 1,
              bestseller: 1,
              trending: 1,
              createdAt: 1,
              sellerId: 1,
              minPrice: 1,
              maxPrice: 1,

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

              subCategory: {
                _id: "$subCategory._id",
                name: "$subCategory.name",
                slug: "$subCategory.slug",
              },

              /**
               * Full variants — typed per size+color combination
               */
              variants: {
                $map: {
                  input: "$variants",
                  as: "v",
                  in: {
                    _id: "$$v._id",
                    sku: "$$v.sku",
                    size: { $ifNull: ["$$v.attributes.size", ""] },
                    color: { $ifNull: ["$$v.attributes.color", ""] },
                    price: "$$v.price",
                    compareAtPrice: "$$v.compareAtPrice",
                    images: "$$v.images",
                    isActive: "$$v.isActive",
                  },
                },
              },

              /**
               * sizes — convenience list for UI pickers and cart
               */
              sizes: {
                $map: {
                  input: "$variants",
                  as: "variant",
                  in: {
                    variantId: "$$variant._id",
                    size: { $ifNull: ["$$variant.attributes.size", ""] },
                    color: { $ifNull: ["$$variant.attributes.color", ""] },
                    price: "$$variant.price",
                    compareAtPrice: "$$variant.compareAtPrice",
                    images: "$$variant.images",
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
                        in: { $ifNull: ["$$inventoryItem.stock", 0] },
                      },
                    },
                  },
                },
              },
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

    console.log("PARAM ID:", rawId);

    const all = await Product.find().select("_id");
    console.log(
      "ALL IDS:",
      all.map((p: { _id: mongoose.Types.ObjectId }) => p._id.toString()),
    );

    const result = await Product.aggregate([
      {
        $match: {
          _id: objectId,
        },
      },
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
            {
              $addFields: {
                variantId: { $toString: "$_id" },
              },
            },
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
      {
        $addFields: {
          images: {
            $reduce: {
              input: "$variants",
              initialValue: [],
              in: { $concatArrays: ["$$value", "$$this.images"] }
            }
          }
        }
      },
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
      {
        $lookup: {
          from: "categories",
          let: { catIds: "$categoryIds" },
          pipeline: [
            { $match: { $expr: { $in: ["$_id", "$$catIds"] } } },
            { $project: { name: 1, slug: 1 } },
          ],
          as: "categories",
        },
      },
      {
        $addFields: {
          minPrice: { $ifNull: [{ $min: "$variants.price" }, 0] },
          maxPrice: { $ifNull: [{ $max: "$variants.price" }, 0] },
        },
      },
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

/**
 * GET SEARCH SUGGESTIONS
 */
export const getSearchSuggestions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { search } = req.query;

    if (!search || typeof search !== "string" || !search.trim()) {
      return res.json({
        success: true,
        data: {
          suggestions: [],
          products: [],
        },
      });
    }

    const query = search.trim();
    const regex = new RegExp(query, "i");

    // 1. Get matching categories
    const categories = await Category.find({
      name: { $regex: regex },
      isActive: true,
    })
      .select("name _id")
      .limit(5);

    // 2. Get matching products with their base price
    const products = await Product.aggregate([
      {
        $match: {
          name: { $regex: regex },
          isActive: true,
        },
      },
      { $limit: 5 },
      {
        $lookup: {
          from: "productvariants",
          localField: "_id",
          foreignField: "productId",
          as: "variants",
        },
      },
      {
        $project: {
          name: 1,
          images: 1,
          price: { $min: "$variants.price" },
        },
      },
    ]);

    // 3. Format suggestions (keywords/categories + unique matching product words)
    const suggestionList: { type: "category" | "keyword"; text: string; id?: string }[] = [];

    // Add category matches
    categories.forEach((cat) => {
      suggestionList.push({
        type: "category",
        text: cat.name,
        id: cat._id.toString(),
      });
    });

    // Add product name matches as keyword suggestions (avoiding duplicates)
    products.forEach((prod) => {
      const cleanName = prod.name.trim();
      const alreadyExists = suggestionList.some(
        (s) => s.text.toLowerCase() === cleanName.toLowerCase(),
      );
      if (!alreadyExists && suggestionList.length < 8) {
        suggestionList.push({
          type: "keyword",
          text: cleanName,
        });
      }
    });

    return res.json({
      success: true,
      data: {
        suggestions: suggestionList,
        products,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * UPLOAD IMAGE (BASE64)
 */
export const uploadImage = async (
  req: Request & { file?: any },
  res: Response,
  next: NextFunction,
) => {
  try {
    let buffer: Buffer;
    let contentType: string;
    let originalName: string;

    if (req.file) {
      // Handle file upload via Multer (multipart/form-data)
      buffer = req.file.buffer;
      contentType = req.file.mimetype;
      originalName = req.file.originalname;
    } else if (req.body && req.body.image) {
      // Handle base64 image content
      const { image, fileName } = req.body;
      const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ success: false, message: "Invalid base64 image format" });
      }

      contentType = matches[1];
      const base64Data = matches[2];
      buffer = Buffer.from(base64Data, "base64");
      originalName = fileName || "upload";
    } else {
      return res.status(400).json({ success: false, message: "No image content provided" });
    }

    // Determine extension
    let extension = "png";
    if (contentType.includes("jpeg") || contentType.includes("jpg")) {
      extension = "jpg";
    } else if (contentType.includes("webp")) {
      extension = "webp";
    } else if (contentType.includes("gif")) {
      extension = "gif";
    } else if (contentType.includes("svg")) {
      extension = "svg";
    }

    const cleanFileName = originalName
      ? originalName.replace(/[^a-z0-9.]/gi, "_").toLowerCase()
      : "upload";
    
    const baseName = path.basename(cleanFileName, path.extname(cleanFileName));
    const finalFileName = `${Date.now()}-${baseName}.${extension}`;

    // Create the upload document in MongoDB
    const uploadDoc = new Upload({
      filename: finalFileName,
      contentType: contentType,
      data: buffer,
    });
    await uploadDoc.save();

    // Return the relative URL (e.g. /uploads/1712398412-bag.jpg)
    const relativeUrl = `/uploads/${finalFileName}`;

    res.status(200).json({
      success: true,
      message: "Image uploaded successfully",
      url: relativeUrl,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/products/:id
 * Delete a product owned by the authenticated seller.
 * Removes the product, its variants, and related inventory entries.
 */
export const deleteProduct = async (
  req: Request & { seller?: any },
  res: Response,
  next: NextFunction,
) => {
  try {
    const rawId = req.params.id;

    console.log("rawId", rawId)
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product id",
      });
    }

    console.log("request id", req.seller?._id)

    if (!req.seller?._id) {
      return res.status(401).json({
        success: false,
        message: "Seller authentication required",
      });
    }

    const product = await Product.findOne({
      _id: id,
      sellerId: req.seller.ownerUserId || req.seller._id,
    });

    console.log("product", product)

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found or you do not have permission to delete it",
      });
    }

    const variants = await ProductVariant.find({ productId: product._id }).select("_id");
    const variantIds = variants.map((variant) => variant._id);

    await Promise.all([
      Product.deleteOne({ _id: product._id }),
      ProductVariant.deleteMany({ productId: product._id }),
      Inventory.deleteMany({ variantId: { $in: variantIds } }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
      data: {
        productId: product._id,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/products/:id/status
 * Toggle a product between active (visible to customers) and draft (hidden).
 * Also syncs isActive on all of the product's variants.
 *
 * Body: { isActive: boolean }
 * OR no body → auto-toggles the current value
 */
export const toggleProductStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product id",
      });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // If body explicitly sends isActive use it; otherwise toggle current value
    const newIsActive =
      typeof req.body?.isActive === "boolean"
        ? req.body.isActive
        : !product.isActive;

    // Update product
    product.isActive = newIsActive;
    await product.save();

    // Sync all variants of this product
    await ProductVariant.updateMany(
      { productId: product._id },
      { $set: { isActive: newIsActive } },
    );

    return res.status(200).json({
      success: true,
      message: newIsActive
        ? "Product is now active and visible to customers"
        : "Product moved to draft — hidden from customers",
      data: {
        productId: product._id,
        isActive: newIsActive,
        status: newIsActive ? "active" : "draft",
      },
    });
  } catch (err) {
    next(err);
  }
};