// import swaggerJsdoc from "swagger-jsdoc";
// import pkg from "../package.json" with { type: "json" };

// const { version } = pkg;

// const options: swaggerJsdoc.Options = {
//   definition: {
//     openapi: "3.0.0",
//     info: {
//       title: "Vault Vogue Lite Server API",
//       version: version || "1.0.0",
//       description: "API Documentation for the Vault Vogue Lite Server.",
//     },
//     servers: [
//       {
//         url: `http://localhost:${process.env.PORT || 5000}`,
//         description: "Local Development Server",
//       },
//       {
//         url: "https://vault-vogue-server.vercel.app/",
//         description: "Development Server",
//       },
//     ],
//     security: [
//       {
//         bearerAuth: [],
//         cookieAuth: [],
//       },
//     ],
//     components: {
//       securitySchemes: {
//         bearerAuth: {
//           type: "http",
//           scheme: "bearer",
//           bearerFormat: "JWT",
//         },
//         cookieAuth: {
//           type: "apiKey",
//           in: "cookie",
//           name: "connect.sid",
//         },
//       },
//     },
//   },
//   apis: ["./routes/*.ts", "./models/*.ts"], // Pattern to find JSDoc annotations
// };

// export const swaggerSpec = swaggerJsdoc(options);

import swaggerJSDoc from "swagger-jsdoc";

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "E-Commerce API",
      version: "1.0.0",
      description: "Production-grade E-commerce API documentation",
    },

    servers: [
      {
        url: "http://localhost:5000/api",
        description: "Local",
      },
      {
        url: "https://api.yourdomain.com/api",
        description: "Production",
      },
    ],

    tags: [
      { name: "Products" },
      { name: "Cart" },
      { name: "Orders" },
      { name: "Checkout" },
    ],

    security: [{ bearerAuth: [] }],

    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },

      /**
       * 🔥 STANDARD RESPONSE WRAPPER
       */
      schemas: {
        ApiResponse: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: {},
          },
        },

        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string" },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },

        /**
         * 📦 PAGINATION
         */
        Pagination: {
          type: "object",
          properties: {
            total: { type: "integer" },
            page: { type: "integer" },
            limit: { type: "integer" },
            totalPages: { type: "integer" },
            hasNextPage: { type: "boolean" },
            hasPrevPage: { type: "boolean" },
          },
        },

        ProductImage: {
          type: "object",
          required: ["url"],
          properties: {
            url: {
              type: "string",
              example: "https://vault-vogue-server.vercel.app/p_img1.png",
            },
            isPrimary: { type: "boolean", example: true },
          },
        },

        ProductVariantInput: {
          type: "object",
          required: ["sku", "price"],
          properties: {
            sku: { type: "string", example: "seed-001-s" },
            attributes: {
              type: "object",
              additionalProperties: true,
              example: { size: "S" },
            },
            price: { type: "number", example: 100 },
            compareAtPrice: { type: "number", example: 120 },
            images: {
              type: "array",
              items: { type: "string" },
              example: ["https://vault-vogue-server.vercel.app/p_img1.png"],
            },
            stock: { type: "number", example: 100 },
          },
        },

        ProductCreateInput: {
          type: "object",
          required: ["sellerId", "name", "categoryIds", "images", "variants"],
          properties: {
            sellerId: { type: "string", example: "67dfa578452634da4759aaa1" },
            name: {
              type: "string",
              example: "Women Round Neck Cotton Top",
            },
            description: {
              type: "string",
              example: "A lightweight cotton top from the seeded catalog.",
            },
            categoryIds: {
              type: "array",
              items: { type: "string" },
              example: ["67dfa578452634da4759bbb1"],
            },
            subCategoryId: {
              type: "string",
              example: "67dfa578452634da4759ccc1",
            },
            images: {
              type: "array",
              items: { $ref: "#/components/schemas/ProductImage" },
            },
            variants: {
              type: "array",
              items: { $ref: "#/components/schemas/ProductVariantInput" },
            },
            bestseller: { type: "boolean", example: false },
            trending: { type: "boolean", example: false },
            details: {
              type: "object",
              additionalProperties: true,
              example: {},
            },
          },
        },

        /**
         * 🛍 PRODUCT CORE
         */
        Product: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            sellerId: { type: "string" },

            categoryIds: {
              type: "array",
              items: { type: "string" },
            },

            subCategoryId: { type: "string" },

            images: {
              type: "array",
              items: {
                $ref: "#/components/schemas/ProductImage",
              },
            },

            bestseller: { type: "boolean" },
            trending: { type: "boolean" },
            isActive: { type: "boolean" },
            details: {
              type: "object",
              additionalProperties: true,
            },

            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
          example: {
            _id: "67dfa578452634da4759aa01",
            sellerId: "67dfa578452634da4759aaa1",
            name: "Women Round Neck Cotton Top",
            description: "A lightweight cotton top from the seeded catalog.",
            categoryIds: ["67dfa578452634da4759bbb1"],
            subCategoryId: "67dfa578452634da4759ccc1",
            images: [
              {
                url: "https://vault-vogue-server.vercel.app/p_img1.png",
                isPrimary: true,
              },
            ],
            bestseller: false,
            trending: false,
            isActive: true,
            details: {},
            createdAt: "2024-05-26T12:32:25.448Z",
            updatedAt: "2024-05-26T12:32:25.448Z",
          },
        },

        /**
         * 🎯 VARIANT
         */
        ProductVariant: {
          type: "object",
          required: ["sku", "price"],
          properties: {
            _id: { type: "string" },
            productId: { type: "string" },
            sku: { type: "string" },

            attributes: {
              type: "object",
              additionalProperties: true,
              example: { size: "S" },
            },

            price: { type: "number" },
            compareAtPrice: { type: "number" },

            images: {
              type: "array",
              items: { type: "string" },
            },

            stock: { type: "number" },
          },
          example: {
            _id: "67dfa578452634da4759vv01",
            productId: "67dfa578452634da4759aa01",
            sku: "seed-001-s",
            attributes: { size: "S" },
            price: 100,
            compareAtPrice: 120,
            images: ["https://vault-vogue-server.vercel.app/p_img1.png"],
            stock: 100,
          },
        },

        /**
         * 🛒 CART
         */
        Cart: {
          type: "object",
          properties: {
            userId: { type: "string" },

            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  productId: { type: "string" },
                  variantId: { type: "string" },
                  quantity: { type: "number" },
                  priceSnapshot: { type: "number" },
                },
              },
            },

            totalAmount: { type: "number" },
          },
        },

        /**
         * 📦 ORDER
         */
        Order: {
          type: "object",
          properties: {
            _id: { type: "string" },
            userId: { type: "string" },

            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  productId: { type: "string" },
                  variantId: { type: "string" },
                  quantity: { type: "number" },
                  priceSnapshot: { type: "number" },
                },
              },
            },

            totalAmount: { type: "number" },

            status: {
              type: "string",
              enum: [
                "pending",
                "confirmed",
                "shipped",
                "delivered",
                "cancelled",
              ],
            },

            paymentStatus: {
              type: "string",
              enum: ["pending", "paid", "failed", "refunded"],
            },

            createdAt: {
              type: "string",
              format: "date-time",
            },
          },
        },

        /**
         * 🔍 PRODUCT LIST RESPONSE
         */
        ProductListResponse: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "array",
              items: {
                $ref: "#/components/schemas/Product",
              },
            },
            pagination: {
              $ref: "#/components/schemas/Pagination",
            },
          },
        },

        /**
         * 🔎 PRODUCT DETAIL
         */
        ProductDetailResponse: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              allOf: [
                { $ref: "#/components/schemas/Product" },
                {
                  type: "object",
                  properties: {
                    variants: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/ProductVariant",
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },
  },

  /**
   * 🔥 IMPORTANT: Use TS routes also
   */
  apis: [
    "./src/routes/*.ts",
    "./src/controllers/*.ts",
    "./src/docs/*.ts",
    "./src/docs/*.js",
  ],
};

export const swaggerSpec = swaggerJSDoc(options);
