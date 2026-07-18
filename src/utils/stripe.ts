import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export const getStripeClient = (): Stripe => {
  if (stripeClient) {
    return stripeClient;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable');
  }

  stripeClient = new Stripe(secretKey);

  return stripeClient;
};

// Api to create a checkout session
export const createCheckoutSession = async (data: { product: any[]; orderId: string }) => {
  try {
    const { product, orderId } = data;

    const stripe = getStripeClient();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: product.map((item: any) => ({
        price_data: {
          currency: 'inr',
          product_data: {
            name: item.name,
            images: item.image && (item.image.startsWith('http://') || item.image.startsWith('https://')) ? [item.image] : undefined,
          },
          unit_amount: Math.round(item.price * 100), // Stripe expects the amount in cents
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
      cancel_url: `${process.env.CLIENT_URL}/checkout?order_id=${orderId}&cancelled=true`,
    });

    console.log("Session Received", session);

    return session;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};
