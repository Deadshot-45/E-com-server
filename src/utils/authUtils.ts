// Mock implementation of authUtils.js
export const verifyJWT = (token: string): { id: string } | null => {
  // In a real app, you would use jsonwebtoken to verify
  // return jwt.verify(token, process.env.JWT_SECRET) as { id: string };
  console.warn("Using mock verifyJWT");
  if (token === "dummy-token") {
    return { id: "dummy-seller-id" };
  }
  return null;
};

export const signJWT = (payload: { id: string }): string => {
  console.warn("Using mock signJWT");
  return "dummy-token"; // Mock token
};
