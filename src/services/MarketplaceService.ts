const MarketplaceService = {
  addProductForSeller: async (sellerId: any, productData: any) => {
    throw new Error("addProductForSeller not implemented");
  },
  listProductsForSeller: async (sellerId: any) => {
    throw new Error("listProductsForSeller not implemented");
  },
  listSellersForProduct: async (productId: any) => {
    throw new Error("listSellersForProduct not implemented");
  },
  placeOrder: async (items: any) => {
    throw new Error("placeOrder not implemented");
  },
  cancelOrder: async (items: any) => {
    throw new Error("cancelOrder not implemented");
  },
  updateSellerRating: async (sellerId: any, rating: any) => {
    throw new Error("updateSellerRating not implemented");
  }
};

export default MarketplaceService;
