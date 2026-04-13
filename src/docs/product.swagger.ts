/**
 * @swagger
 * /products/create:
 *   post:
 *     summary: Create a product with variants
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductCreateInput'
 *     responses:
 *       201:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Product created successfully
 *                     data:
 *                       type: object
 *                       example:
 *                         _id: 67dfa578452634da4759aa01
 *                         sellerId: 67dfa578452634da4759aaa1
 *                         name: Women Round Neck Cotton Top
 *                         description: A lightweight cotton top from the seeded catalog.
 *                         categoryIds:
 *                           - 67dfa578452634da4759bbb1
 *                         subCategoryId: 67dfa578452634da4759ccc1
 *                         images:
 *                           - url: https://vault-vogue-server.vercel.app/p_img1.png
 *                             isPrimary: true
 *                         isActive: true
 *                         bestseller: false
 *                         trending: false
 *                         details: {}
 *       400:
 *         description: Invalid product payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /products/getAll:
 *   get:
 *     summary: Get products with filters, search, and pagination
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Full-text search term
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *       - in: query
 *         name: subCategoryId
 *         schema:
 *           type: string
 *       - in: query
 *         name: sellerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: bestseller
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: trending
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, name]
 *           default: createdAt
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Products fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ProductListResponse'
 *                 - type: object
 *                   example:
 *                     success: true
 *                     data:
 *                       - _id: 67dfa578452634da4759aa01
 *                         sellerId: 67dfa578452634da4759aaa1
 *                         name: Women Round Neck Cotton Top
 *                         categoryIds:
 *                           - 67dfa578452634da4759bbb1
 *                         subCategoryId: 67dfa578452634da4759ccc1
 *                         images:
 *                           - url: https://vault-vogue-server.vercel.app/p_img1.png
 *                             isPrimary: true
 *                         isActive: true
 *                         bestseller: false
 *                         trending: false
 *                         createdAt: 2024-05-26T12:32:25.448Z
 *                         updatedAt: 2024-05-26T12:32:25.448Z
 *                       - _id: 67dfa578452634da4759aa02
 *                         sellerId: 67dfa578452634da4759aaa1
 *                         name: Men Round Neck Pure Cotton T-shirt
 *                         categoryIds:
 *                           - 67dfa578452634da4759bbb2
 *                         subCategoryId: 67dfa578452634da4759ccc3
 *                         images:
 *                           - url: https://vault-vogue-server.vercel.app/p_img2_1.png
 *                             isPrimary: true
 *                         isActive: true
 *                         bestseller: false
 *                         trending: false
 *                         createdAt: 2024-05-26T09:02:25.448Z
 *                         updatedAt: 2024-05-26T09:02:25.448Z
 *                     pagination:
 *                       total: 50
 *                       page: 1
 *                       limit: 10
 *                       totalPages: 5
 *                       hasNextPage: true
 *                       hasPrevPage: false
 *
 * /products/getById/{id}:
 *   get:
 *     summary: Get a product by id with active variants and stock
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product id
 *     responses:
 *       200:
 *         description: Product fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ProductDetailResponse'
 *                 - type: object
 *                   example:
 *                     success: true
 *                     data:
 *                       _id: 67dfa578452634da4759aa01
 *                       sellerId: 67dfa578452634da4759aaa1
 *                       name: Women Round Neck Cotton Top
 *                       categoryIds:
 *                         - 67dfa578452634da4759bbb1
 *                       subCategoryId: 67dfa578452634da4759ccc1
 *                       images:
 *                         - url: https://vault-vogue-server.vercel.app/p_img1.png
 *                           isPrimary: true
 *                       isActive: true
 *                       bestseller: false
 *                       trending: false
 *                       details: {}
 *                       variants:
 *                         - _id: 67dfa578452634da4759vv01
 *                           productId: 67dfa578452634da4759aa01
 *                           sku: seed-001-s
 *                           attributes:
 *                             size: S
 *                             color: Red
 *                           price: 100
 *                           compareAtPrice: 120
 *                           images:
 *                             - https://vault-vogue-server.vercel.app/p_img1.png
 *                           stock: 100
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Product not found
 */

export {};
