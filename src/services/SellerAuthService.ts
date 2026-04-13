const SellerAuthService = {
  registerSeller: async (data: any): Promise<any> => {
    throw new Error("registerSeller not implemented");
  },
  loginSeller: async (email: string, password: string): Promise<any> => {
    throw new Error("loginSeller not implemented");
  },
  sendOTP: async (sellerId: string): Promise<any> => {
    throw new Error("sendOTP not implemented");
  },
  verifySellerOTP: async (sellerId: string, otp: string): Promise<any> => {
    throw new Error("verifySellerOTP not implemented");
  }
};

export default SellerAuthService;
