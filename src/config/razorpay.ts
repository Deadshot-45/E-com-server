import Razorpay from "razorpay";

let razorpayInstance: Razorpay | null = null;

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (
  keyId &&
  keySecret &&
  keyId !== "your_razorpay_key_id" &&
  keySecret !== "your_razorpay_key_secret"
) {
  razorpayInstance = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
  console.log("✅ Razorpay initialized");
} else {
  console.warn(
    "⚠️  RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set. Online payments will not work.",
  );
}

/**
 * Get the Razorpay instance. Throws if not configured.
 */
export function getRazorpay(): Razorpay {
  if (!razorpayInstance) {
    throw new Error(
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env file.",
    );
  }
  return razorpayInstance;
}

export default razorpayInstance;
