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
                type: "object",
                properties: {
                  url: { type: "string" },
                  isPrimary: { type: "boolean" },
                },
              },
            },

            bestseller: { type: "boolean" },
            trending: { type: "boolean" },
            isActive: { type: "boolean" },

            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
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
              additionalProperties: { type: "string" },
              example: { color: "red", size: "M" },
            },

            price: { type: "number" },
            compareAtPrice: { type: "number" },

            images: {
              type: "array",
              items: { type: "string" },
            },

            stock: { type: "number" },
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
