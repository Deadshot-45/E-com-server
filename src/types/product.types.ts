export interface IVariantInput {
    sku: string;
    attributes?: Record<string, any>;
    price: number;
    compareAtPrice?: number;
    images?: string[];
    stock?: number;
  }
  
  export interface IProductInput {
    sellerId: string;
    name: string;
    description?: string;
    category?: string;
    categoryIds: string[];
    subCategoryId?: string;
    subCategory?: string;
    subCategoryName?: string;
    subcategory?: string;
    subcategoryName?: string;
    images: {
      url: string;
      isPrimary?: boolean;
    }[];
    variants: IVariantInput[];
    bestseller?: boolean;
    trending?: boolean;
    details?: Record<string, any>;
  }