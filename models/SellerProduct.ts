import mongoose, { Document, Schema, CallbackError } from "mongoose";

export interface IVariant {
  _id?: mongoose.Types.ObjectId;
  attributes?: {
    color?: string;
    size?: string;
    material?: string;
  };
  sku?: string;
  price: number;
  inventory: {
    quantity: number;
    updatedAt: Date;
  };
  images: {
    url?: string;
    isPrimary: boolean;
  }[];
  isActive: boolean;
}

export interface ISellerProduct extends Document {
  sellerId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  gtin?: string;
  variants: IVariant[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const variantSchema = new Schema<IVariant>(
  {
    attributes: {
      color: { type: String },
      size: { type: String },
      material: { type: String },
    },
    sku: {
      type: String,
      index: true,
      immutable: true,
      sparse: true,
    },
    price: { type: Number, required: true },
    inventory: {
      quantity: { type: Number, default: 0 },
      updatedAt: { type: Date, default: Date.now },
    },
    images: [
      {
        url: String,
        isPrimary: { type: Boolean, default: false },
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

const sellerProductSchema = new Schema<ISellerProduct>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Seller",
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "ProductCatalog",
      index: true,
    },
    gtin: { type: String, index: true },
    variants: [variantSchema],
    isActive: { type: Boolean, default: true },
    deletedAt: Date,
  },
  { timestamps: true }
);

sellerProductSchema.index({ sellerId: 1, productId: 1 }, { unique: true });
sellerProductSchema.index({ "variants.sku": 1 });

sellerProductSchema.pre("save", function (this: any, next: any) {
  this.variants.forEach((variant: any) => {
    if (!variant.inventory.updatedAt) {
      variant.inventory.updatedAt = new Date();
    }

    if (variant.sku) return;

    const sellerPart = this.sellerId.toString().slice(-4).toUpperCase();
    const productPart = this.productId.toString().slice(-4).toUpperCase();

    const colorPart =
      variant.attributes?.color?.substring(0, 3).toUpperCase() || "DEF";

    const sizePart = variant.attributes?.size?.toUpperCase() || "NA";

    const timePart = Date.now().toString().slice(-5);

    variant.sku = `SKU-${productPart}-${colorPart}-${sizePart}-${sellerPart}-${timePart}`;
  });

  next();
});

export default mongoose.model<ISellerProduct>("SellerProduct", sellerProductSchema);
