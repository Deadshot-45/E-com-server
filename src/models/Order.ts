import mongoose from "mongoose";


const OrderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: String, required: true }, // size & color unique identifier
  name: { type: String, required: true },
  image: { type: String },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true }, // price snapshot
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});

const OrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [OrderItemSchema],
  shippingAddress: {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, default: 'India' }
  },
  shippingMethod: { type: String, enum: ['standard', 'express', 'vip'], default: 'standard' },
  shippingFee: { type: Number, required: true },
  subtotal: { type: Number, required: true },
  tax: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  
  // Payment states
  paymentMethod: { type: String, enum: ['card', 'cod', 'upi'], required: true },
  paymentStatus: { type: String, enum: ['unpaid', 'paid', 'failed', 'refunded'], default: 'unpaid' },
  stripePaymentIntentId: { type: String },
  
  // Fulfillment states
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'], 
    default: 'pending' 
  }
}, { timestamps: true });


export const Order = mongoose.model("Order", OrderSchema);