const MarketplaceService = {
  addProductForSeller: async (sellerId, productData) => {
    throw new Error("addProductForSeller not implemented");
  },
  listProductsForSeller: async (sellerId) => {
    throw new Error("listProductsForSeller not implemented");
  },
  listSellersForProduct: async (productId) => {
    throw new Error("listSellersForProduct not implemented");
  },
  placeOrder: async (items) => {
    throw new Error("placeOrder not implemented");
  },
  cancelOrder: async (items) => {
    throw new Error("cancelOrder not implemented");
  },
  updateSellerRating: async (sellerId, rating) => {
    throw new Error("updateSellerRating not implemented");
  }
};

export default MarketplaceService;
