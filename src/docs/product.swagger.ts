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
 *             type: object
 *             required:
 *               - sellerId
 *               - name
 *               - categoryIds
 *             properties:
 *               sellerId:
 *                 type: string
 *                 example: 67f0ab12cd34ef56ab78cd90
 *               name:
 *                 type: string
 *                 example: Classic Hoodie
 *               description:
 *                 type: string
 *                 example: Premium cotton hoodie for everyday wear.
 *               categoryIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: [67f0ab12cd34ef56ab78cd91]
 *               subCategoryId:
 *                 type: string
 *                 example: 67f0ab12cd34ef56ab78cd92
 *               images:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       example: https://example.com/images/hoodie-front.jpg
 *                     isPrimary:
 *                       type: boolean
 *                       example: true
 *               bestseller:
 *                 type: boolean
 *                 example: false
 *               trending:
 *                 type: boolean
 *                 example: true
 *               isActive:
 *                 type: boolean
 *                 example: true
 *               variants:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/ProductVariant'
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
 *                       $ref: '#/components/schemas/Product'
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
 *               $ref: '#/components/schemas/ProductListResponse'
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
 *               $ref: '#/components/schemas/ProductDetailResponse'
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
