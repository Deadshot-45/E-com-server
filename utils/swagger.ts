import swaggerJsdoc from "swagger-jsdoc";
import pkg from "../package.json" with { type: "json" };

const { version } = pkg;

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Vault Vogue Lite Server API",
      version: version || "1.0.0",
      description: "API Documentation for the Vault Vogue Lite Server.",
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 5000}`,
        description: "Local Development Server",
      },
      {
        url: "https://vault-vogue-server.vercel.app/",
        description: "Development Server",
      },
    ],
    security: [
      {
        bearerAuth: [],
        cookieAuth: [],
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "connect.sid",
        },
      },
    },
  },
  apis: ["./routes/*.ts", "./models/*.ts"], // Pattern to find JSDoc annotations
};

export const swaggerSpec = swaggerJsdoc(options);
