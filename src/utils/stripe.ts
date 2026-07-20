import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export const getStripeClient = (): Stripe => {
  if (stripeClient) {
    return stripeClient;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_mock_secret_key';
  stripeClient = new Stripe(secretKey);

  return stripeClient;
};

/**
 * Verify and construct a Stripe event from raw body Buffer and signature header.
 */
export const constructStripeEvent = (
  rawBody: Buffer | string,
  signature: string
): Stripe.Event => {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET environment variable is missing');
  }

  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
};

// Api to create a checkout session
export const createCheckoutSession = async (data: {
  product: any[];
  orderId: string;
  shippingFee: number;
  tax?: number;
  discount?: number;
}) => {
  try {
    const { product, orderId, shippingFee, tax, discount } = data;

    const stripe = getStripeClient();

    const lineItems: any[] = product.map((item: any) => ({
      price_data: {
        currency: 'inr',
        product_data: {
          name: item.name,
          images: item.image && (item.image.startsWith('http://') || item.image.startsWith('https://')) ? [item.image] : undefined,
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
      adjustable_quantity: {
        enabled: true,
        minimum: 1,
        maximum: Math.max(Number(item.quantity) || 1, 2),
      },
    }));

    if (shippingFee > 0) {
      lineItems.push({
        price_data: {
          currency: 'inr',
          product_data: {
            name: 'Shipping Fee',
          },
          unit_amount: Math.round(shippingFee * 100),
        },
        quantity: 1,
      });
    }

    if (tax && tax > 0) {
      lineItems.push({
        price_data: {
          currency: 'inr',
          product_data: {
            name: 'Tax (8%)',
          },
          unit_amount: Math.round(tax * 100),
        },
        quantity: 1,
      });
    }

    let discounts: any[] | undefined = undefined;
    if (discount && discount > 0) {
      try {
        const coupon = await stripe.coupons.create({
          amount_off: Math.round(discount * 100),
          currency: 'inr',
          duration: 'once',
        });
        discounts = [{ coupon: coupon.id }];
      } catch (couponError) {
        console.error('Error creating Stripe coupon:', couponError);
      }
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      discounts,
      mode: 'payment',
      metadata: {
        orderId: orderId,
      },
      payment_intent_data: {
        metadata: {
          orderId: orderId,
        },
      },
      client_reference_id: orderId,
      success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/checkout?order_id=${orderId}&cancelled=true`,
    });

    console.log("Stripe Checkout Session Created:", session.id);

    return session;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};
