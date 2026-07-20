import Razorpay from "razorpay";

export function getRazorpayKeys() {
  const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_TFnjdkFu74wVJr";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "iG11tM788qm0aDFuQn3jEVYF";
  return { keyId, keySecret };
}

export function isRazorpayConfigured(): boolean {
  const { keyId, keySecret } = getRazorpayKeys();
  return Boolean(
    keyId &&
      keySecret &&
      keyId !== "your_razorpay_key_id" &&
      keySecret !== "your_razorpay_key_secret" &&
      keyId.trim().length > 0 &&
      keySecret.trim().length > 0
  );
}

export function getRazorpay(): Razorpay {
  const { keyId, keySecret } = getRazorpayKeys();
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

export default getRazorpay;
