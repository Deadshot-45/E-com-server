import { orderService } from "../src/services/order-service.js";
import { paymentService } from "../src/services/payment-service.js";
import { trackingStore } from "../src/store/tracking-store.js";
import { OrderStatus, PaymentStatus } from "../src/types/order-tracking.js";

async function runDualVerificationTests() {
  console.log("==================================================");
  console.log("🧪 STARTING DUAL PAYMENT VERIFICATION TESTS (WEBHOOK + MANUAL CHECK)");
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
    // TEST 1: Async Webhook Execution & Verification (Razorpay)
    // ----------------------------------------------------
    console.log("--> 1. Testing Async Razorpay Webhook Event...");
    const rzpOrderId = `ORD-ASYNC-RZP-${Date.now()}`;
    await trackingStore.addCheckpoint({
      checkpointId: `CHK-ASYNC-RZP-01`,
      orderId: rzpOrderId,
      status: OrderStatus.PENDING_PAYMENT,
      location: "Checkout",
      description: "Awaiting Webhook",
      timestamp: new Date().toISOString(),
    });

    const rzpLog = await paymentService.processRazorpayWebhookEvent(
      JSON.stringify({
        event: "order.paid",
        event_id: `rzp_evt_async_${Date.now()}`,
        payload: {
          payment: {
            entity: {
              id: `pay_rzp_async_${Date.now()}`,
              order_id: `order_rzp_async_${Date.now()}`,
              amount: 120000,
              currency: "INR",
              notes: { orderId: rzpOrderId },
            },
          },
        },
      }),
      ""
    );
    assert(rzpLog.status === "SUCCESS", "Async Webhook returned SUCCESS status");

    const rzpTracking = await orderService.getOrderTracking(rzpOrderId);
    assert(rzpTracking.currentStatus === OrderStatus.PAYMENT_AUTHORIZED, "Order tracking updated to PAYMENT_AUTHORIZED via Webhook");

    // ----------------------------------------------------
    // TEST 2: Duplicate Webhook Idempotency Check
    // ----------------------------------------------------
    console.log("\n--> 2. Testing Webhook Idempotency (Duplicate Event)...");
    const duplicateLog = await paymentService.processRazorpayWebhookEvent(
      JSON.stringify({
        event: "order.paid",
        event_id: rzpLog.eventId,
        payload: {
          payment: {
            entity: {
              id: `pay_rzp_async_${Date.now()}`,
              order_id: `order_rzp_async_${Date.now()}`,
            },
          },
        },
      }),
      ""
    );
    assert(duplicateLog.status === "IGNORED", "Duplicate Webhook event ignored idempotently");

    // ----------------------------------------------------
    // TEST 3: Async Webhook Execution & Verification (Stripe)
    // ----------------------------------------------------
    console.log("\n--> 3. Testing Async Stripe Webhook Event...");
    const stripeOrderId = `ORD-ASYNC-STRIPE-${Date.now()}`;
    await trackingStore.addCheckpoint({
      checkpointId: `CHK-ASYNC-STRIPE-01`,
      orderId: stripeOrderId,
      status: OrderStatus.PENDING_PAYMENT,
      location: "Checkout",
      description: "Awaiting Stripe Webhook",
      timestamp: new Date().toISOString(),
    });

    const stripeLog = await paymentService.processStripeWebhookEvent({
      id: `evt_stripe_async_${Date.now()}`,
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: `pi_stripe_async_${Date.now()}`,
          amount: 120000,
          currency: "inr",
          metadata: { orderId: stripeOrderId },
        },
      },
    });
    assert(stripeLog.status === "SUCCESS", "Async Stripe Webhook returned SUCCESS");

    const stripeTracking = await orderService.getOrderTracking(stripeOrderId);
    assert(stripeTracking.currentStatus === OrderStatus.PAYMENT_AUTHORIZED, "Stripe order tracking updated to PAYMENT_AUTHORIZED via Webhook");

    // ----------------------------------------------------
    // TEST 4: Manual Status Sync Verification
    // ----------------------------------------------------
    console.log("\n--> 4. Testing Sync Manual Status Check...");
    const syncOrderId = `ORD-SYNC-CHECK-${Date.now()}`;
    await trackingStore.addCheckpoint({
      checkpointId: `CHK-SYNC-01`,
      orderId: syncOrderId,
      status: OrderStatus.PENDING_PAYMENT,
      location: "Frontend Check",
      description: "Awaiting Manual Status Check",
      timestamp: new Date().toISOString(),
    });

    const manualInit = await paymentService.initializePayment({
      orderId: syncOrderId,
      amount: 1200.00,
      currency: "INR",
      gateway: "STRIPE",
      idempotencyKey: `IDEM-SYNC-${Date.now()}`,
    });

    const fetchedStatus = await paymentService.getPaymentStatus(manualInit.payment.paymentId);
    assert(fetchedStatus.paymentId === manualInit.payment.paymentId, "Manual status endpoint fetched transaction record");
    assert(fetchedStatus.status === PaymentStatus.INITIATED, "Initial status correctly reported as INITIATED");

  } catch (error: any) {
    console.error("❌ Exception during test execution:", error);
  }

  console.log("\n==================================================");
  console.log(`📊 SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log("==================================================");

  if (passedTests === totalTests) {
    console.log("🎉 DUAL PAYMENT VERIFICATION TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  } else {
    console.error("💥 SOME TESTS FAILED.");
    process.exit(1);
  }
}

runDualVerificationTests();
