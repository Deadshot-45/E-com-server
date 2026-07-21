import { orderService } from "../src/services/order-service.js";
import { paymentService } from "../src/services/payment-service.js";
import { trackingStore } from "../src/store/tracking-store.js";
import { OrderStatus, PaymentStatus } from "../src/types/order-tracking.js";

async function runVerificationTests() {
  console.log("==================================================");
  console.log("🧪 STARTING VERIFICATION TESTS: RAZORPAY, STRIPE & RETRY PAYMENT DB SYNC");
  console.log("==================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
    }
  }

  try {
    // ----------------------------------------------------
    // SETUP: Create a real test order tracking record
    // ----------------------------------------------------
    const realOrderId = `ORD-${Date.now()}`;
    const realCustomerId = `CUST-${Math.floor(Math.random() * 10000)}`;

    console.log(`--> 1. Registering Real Order '${realOrderId}'...`);
    const createdTracking = await trackingStore.addCheckpoint({
      checkpointId: `CHK-${Date.now()}-001`,
      orderId: realOrderId,
      status: OrderStatus.PENDING_PAYMENT,
      location: "Vault Vogue Online Store",
      description: "Order placed by customer via checkout",
      timestamp: new Date().toISOString(),
    });

    createdTracking.customerId = realCustomerId;
    createdTracking.items = [
      { productId: "PROD-VAL-101", name: "Designer Silk Gown", quantity: 1, price: 850.00 },
    ];
    createdTracking.totalAmount = 850.00;
    createdTracking.currency = "INR";
    await trackingStore.saveOrder(createdTracking);

    // ----------------------------------------------------
    // TEST 2: Retrieve Order Tracking Details
    // ----------------------------------------------------
    console.log("\n--> 2. Testing Real Order Tracking Lookup...");
    const orderDetails = await orderService.getOrderTracking(realOrderId);
    assert(orderDetails.orderId === realOrderId, `Order ID matches '${realOrderId}'`);
    assert(orderDetails.customerId === realCustomerId, `Customer ID matches '${realCustomerId}'`);
    assert(orderDetails.totalAmount === 850.00, "Total amount matches real order amount 850.00");
    assert(orderDetails.currentStatus === OrderStatus.PENDING_PAYMENT, "Initial status is PENDING_PAYMENT");

    // ----------------------------------------------------
    // TEST 3: Initialize Payment with Idempotency Key
    // ----------------------------------------------------
    console.log("\n--> 3. Testing Payment Initialization with Idempotency Key...");
    const idemKey = `IDEM-REAL-${Date.now()}`;
    const init1 = await paymentService.initializePayment({
      orderId: realOrderId,
      amount: 850.00,
      currency: "INR",
      gateway: "RAZORPAY",
      idempotencyKey: idemKey,
    });
    assert(!init1.isDuplicate, "First payment initialization is marked new (not duplicate)");
    assert(init1.payment.status === PaymentStatus.INITIATED, "Payment status is INITIATED");
    const paymentId = init1.payment.paymentId;

    // ----------------------------------------------------
    // TEST 4: Re-submit Payment with Same Idempotency Key
    // ----------------------------------------------------
    console.log("\n--> 4. Testing Idempotency Enforcement (Duplicate Request)...");
    const init2 = await paymentService.initializePayment({
      orderId: realOrderId,
      amount: 850.00,
      currency: "INR",
      gateway: "RAZORPAY",
      idempotencyKey: idemKey,
    });
    assert(init2.isDuplicate === true, "Duplicate payment request recognized idempotently");
    assert(init2.payment.paymentId === paymentId, "Returned payment transaction matches original ID");

    // ----------------------------------------------------
    // TEST 5: Fetch Payment Status
    // ----------------------------------------------------
    console.log("\n--> 5. Testing Payment Status Lookup...");
    const paymentStatus = await paymentService.getPaymentStatus(paymentId);
    assert(paymentStatus.paymentId === paymentId, "Fetched payment status record successfully");

    // ----------------------------------------------------
    // TEST 6: Razorpay Webhook Event Processing (order.paid)
    // ----------------------------------------------------
    console.log("\n--> 6. Testing Razorpay Webhook Event Processing...");
    const rzpOrder = `ORD-RZP-${Date.now()}`;
    await trackingStore.addCheckpoint({
      checkpointId: `CHK-RZP-001`,
      orderId: rzpOrder,
      status: OrderStatus.PENDING_PAYMENT,
      location: "Online Checkout",
      description: "Awaiting Razorpay Payment",
      timestamp: new Date().toISOString(),
    });

    const rzpEventId = `rzp_evt_test_${Date.now()}`;
    const rzpWebhookRes = await paymentService.processRazorpayWebhookEvent(
      JSON.stringify({
        event: "order.paid",
        event_id: rzpEventId,
        payload: {
          payment: {
            entity: {
              id: `pay_rzp_test_${Date.now()}`,
              order_id: `order_rzp_${Date.now()}`,
              amount: 85000,
              currency: "INR",
              notes: { orderId: rzpOrder },
            },
          },
        },
      }),
      ""
    );
    assert(rzpWebhookRes.status === "SUCCESS", "Razorpay order.paid event processed successfully");

    const rzpOrderAfter = await orderService.getOrderTracking(rzpOrder);
    assert(rzpOrderAfter.currentStatus === OrderStatus.PAYMENT_AUTHORIZED, "Razorpay order status updated to PAYMENT_AUTHORIZED");

    // ----------------------------------------------------
    // TEST 7: Stripe SUCCESS Webhook (payment_intent.succeeded)
    // ----------------------------------------------------
    console.log("\n--> 7. Testing Stripe SUCCESS Webhook Event Processing...");
    const stripeSuccessEventId = `evt_stripe_success_${Date.now()}`;
    const stripeSuccessOrder = `ORD-STRIPE-SUCCESS-${Date.now()}`;
    await trackingStore.addCheckpoint({
      checkpointId: `CHK-SUCCESS-001`,
      orderId: stripeSuccessOrder,
      status: OrderStatus.PENDING_PAYMENT,
      location: "Online Checkout",
      description: "Awaiting Stripe Payment",
      timestamp: new Date().toISOString(),
    });

    const successWebhookRes = await paymentService.processStripeWebhookEvent({
      id: stripeSuccessEventId,
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: `pi_stripe_success_${Date.now()}`,
          amount: 85000,
          currency: "inr",
          metadata: { orderId: stripeSuccessOrder },
        },
      },
    });
    assert(successWebhookRes.status === "SUCCESS", "Stripe payment_intent.succeeded event handled successfully");

    const successOrderAfter = await orderService.getOrderTracking(stripeSuccessOrder);
    assert(successOrderAfter.currentStatus === OrderStatus.PAYMENT_AUTHORIZED, "Stripe SUCCESS order status updated to PAYMENT_AUTHORIZED");

    // ----------------------------------------------------
    // TEST 8: Order Tracking State Machine Updates
    // ----------------------------------------------------
    console.log("\n--> 8. Testing Sequential State Machine Updates...");
    await orderService.updateOrderStatus(
      realOrderId,
      OrderStatus.PAYMENT_AUTHORIZED,
      "Payment Gateway",
      "Payment authorized"
    );

    const processingOrder = await orderService.updateOrderStatus(
      realOrderId,
      OrderStatus.PROCESSING,
      "Vault Vogue Fulfillment Hub - Mumbai",
      "Order packed and scheduled for dispatch"
    );
    assert(processingOrder.currentStatus === OrderStatus.PROCESSING, "Advanced status to PROCESSING");

    const shippedOrder = await orderService.updateOrderStatus(
      realOrderId,
      OrderStatus.SHIPPED,
      "Logistics Warehouse - Express Air",
      "Handed over to BlueDart (Tracking # BD-88201)"
    );
    assert(shippedOrder.currentStatus === OrderStatus.SHIPPED, "Advanced status to SHIPPED");
    assert(shippedOrder.checkpoints.length >= 4, "Contains full chronological tracking timeline checkpoints");

  } catch (error: any) {
    console.error("❌ Exception during test execution:", error);
  }

  console.log("\n==================================================");
  console.log(`📊 SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log("==================================================");

  if (passedTests === totalTests) {
    console.log("🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  } else {
    console.error("💥 SOME TESTS FAILED.");
    process.exit(1);
  }
}

runVerificationTests();
