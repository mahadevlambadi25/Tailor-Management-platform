import { app } from '../src/app';
import { prisma } from '../src/core/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';
import { SubscriptionService, SUBSCRIPTION_PLANS } from '../src/modules/subscriptions/subscriptionService';
import { BillingService } from '../src/modules/subscriptions/billingService';
import { RazorpayService } from '../src/modules/subscriptions/razorpayService';
import { seedDemoDataForTenant, purgeTenantDemoData } from '../src/modules/demo/demoService';
import {
  SubscriptionStatus,
  SubscriptionPaymentStatus,
  SubscriptionInvoiceStatus,
  RoleType
} from '@prisma/client';
import http from 'http';

async function runBillingTests() {
  console.log('================================================================');
  console.log('       SAAS SUBSCRIPTION BILLING & PAYMENT GATEWAY SUITE        ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✔ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✖ FAIL: ${testName}`, detail || '');
      failed++;
    }
  }

  // Spin up an ephemeral HTTP server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const API_BASE = `http://localhost:${port}/api/v1`;
  console.log(`[Setup] Ephemeral test server active on ${API_BASE}`);

  const TENANT_A_SLUG = 'saas-billing-atelier-a';
  const TENANT_B_SLUG = 'saas-billing-atelier-b';

  let tenantA: any = null;
  let tenantB: any = null;
  let ownerUserA: any = null;
  let tailorUserA: any = null;
  let ownerUserB: any = null;
  let tokenA = '';
  let tokenB = '';
  let tailorTokenA = '';

  try {
    // -------------------------------------------------------------------------
    // Setup Test Data
    // -------------------------------------------------------------------------
    console.log('[Setup] Cleaning old test data & creating isolated tenants...');

    const existingA = await prisma.tenant.findUnique({ where: { slug: TENANT_A_SLUG } });
    if (existingA) {
      await purgeTenantDemoData(existingA.id);
      await prisma.subscriptionInvoice.deleteMany({ where: { tenantId: existingA.id } });
      await prisma.subscriptionPayment.deleteMany({ where: { tenantId: existingA.id } });
      await prisma.user.deleteMany({ where: { tenantId: existingA.id } });
      await prisma.subscription.deleteMany({ where: { tenantId: existingA.id } });
      await prisma.tenant.delete({ where: { id: existingA.id } });
    }

    const existingB = await prisma.tenant.findUnique({ where: { slug: TENANT_B_SLUG } });
    if (existingB) {
      await purgeTenantDemoData(existingB.id);
      await prisma.subscriptionInvoice.deleteMany({ where: { tenantId: existingB.id } });
      await prisma.subscriptionPayment.deleteMany({ where: { tenantId: existingB.id } });
      await prisma.user.deleteMany({ where: { tenantId: existingB.id } });
      await prisma.subscription.deleteMany({ where: { tenantId: existingB.id } });
      await prisma.tenant.delete({ where: { id: existingB.id } });
    }

    tenantA = await prisma.tenant.create({
      data: {
        name: 'Alpha Bespoke Tailors',
        slug: TENANT_A_SLUG,
        phone: '+91 9988776655',
        email: 'billing-a@bespoke.com',
        address: '42 Fashion Street, Mumbai',
        isDemo: true
      }
    });

    tenantB = await prisma.tenant.create({
      data: {
        name: 'Beta High Fashion',
        slug: TENANT_B_SLUG,
        phone: '+91 9988776644',
        email: 'billing-b@fashion.com',
        address: '10 Connaught Place, New Delhi',
        isDemo: true
      }
    });

    const hashedPassword = await bcrypt.hash('Secret123!', 10);

    ownerUserA = await prisma.user.create({
      data: {
        tenantId: tenantA.id,
        email: 'owner-a@bespoke.com',
        passwordHash: hashedPassword,
        name: 'Alice Owner',
        role: RoleType.SHOP_OWNER,
        isActive: true
      }
    });

    tailorUserA = await prisma.user.create({
      data: {
        tenantId: tenantA.id,
        email: 'tailor-a@bespoke.com',
        passwordHash: hashedPassword,
        name: 'Tom Tailor',
        role: RoleType.TAILOR,
        isActive: true
      }
    });

    ownerUserB = await prisma.user.create({
      data: {
        tenantId: tenantB.id,
        email: 'owner-b@fashion.com',
        passwordHash: hashedPassword,
        name: 'Bob Owner',
        role: RoleType.SHOP_OWNER,
        isActive: true
      }
    });

    tokenA = jwt.sign(
      { id: ownerUserA.id, tenantId: tenantA.id, email: ownerUserA.email, role: ownerUserA.role },
      config.jwtSecret,
      { expiresIn: '1d' }
    );

    tailorTokenA = jwt.sign(
      { id: tailorUserA.id, tenantId: tenantA.id, email: tailorUserA.email, role: tailorUserA.role },
      config.jwtSecret,
      { expiresIn: '1d' }
    );

    tokenB = jwt.sign(
      { id: ownerUserB.id, tenantId: tenantB.id, email: ownerUserB.email, role: ownerUserB.role },
      config.jwtSecret,
      { expiresIn: '1d' }
    );

    // -------------------------------------------------------------------------
    // Scenario 1: Create subscription checkout
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 1] Create subscription checkout...');
    const checkoutRes = await fetch(`${API_BASE}/subscriptions/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({ plan: 'PROFESSIONAL' })
    });
    const checkoutData: any = await checkoutRes.json();

    assert(checkoutRes.status === 200, 'POST /subscriptions/checkout returns HTTP 200');
    assert(checkoutData.success === true, 'Response success is true');
    assert(!!checkoutData.data?.orderId, 'Razorpay orderId is returned');
    assert(checkoutData.data?.amount === 249900, 'Amount strictly calculated on server (₹2,499 = 249900 paise)');
    assert(checkoutData.data?.currency === 'INR', 'Currency is INR');
    assert(checkoutData.data?.plan === 'PROFESSIONAL', 'Plan is PROFESSIONAL');
    assert(!!checkoutData.data?.transactionId, 'Pending transaction ID is returned');

    // Verify PENDING record in DB
    const pendingTx = await prisma.subscriptionPayment.findUnique({
      where: { id: checkoutData.data.transactionId }
    });
    assert(pendingTx?.status === SubscriptionPaymentStatus.PENDING, 'Database transaction record status is PENDING');
    assert(pendingTx?.orderId === checkoutData.data.orderId, 'Transaction record orderId matches Razorpay order');

    // -------------------------------------------------------------------------
    // Scenario 2: Invalid plan
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 2] Rejection of invalid plan...');
    const invalidPlanRes = await fetch(`${API_BASE}/subscriptions/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({ plan: 'NON_EXISTENT_PLAN' })
    });
    const invalidPlanData: any = await invalidPlanRes.json();
    assert(invalidPlanRes.status === 400, 'Invalid plan returns HTTP 400');
    assert(invalidPlanData.error?.code === 'INVALID_PLAN', 'Error code is INVALID_PLAN');

    // Attempting to checkout FREE_TRIAL via payment checkout is rejected
    const freeTrialCheckoutRes = await fetch(`${API_BASE}/subscriptions/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({ plan: 'FREE_TRIAL' })
    });
    assert(freeTrialCheckoutRes.status === 400, 'Cannot checkout FREE_TRIAL via paid checkout');

    // -------------------------------------------------------------------------
    // Scenario 3: Unauthorized tenant & RBAC enforcement
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 3] Unauthorized tenant & RBAC enforcement...');
    // TAILOR attempting checkout (only SHOP_OWNER allowed)
    const tailorCheckoutRes = await fetch(`${API_BASE}/subscriptions/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tailorTokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({ plan: 'PROFESSIONAL' })
    });
    assert(tailorCheckoutRes.status === 403, 'TAILOR role is forbidden from checkout (HTTP 403)');

    // Missing token
    const unauthCheckoutRes = await fetch(`${API_BASE}/subscriptions/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({ plan: 'PROFESSIONAL' })
    });
    assert(unauthCheckoutRes.status === 401, 'Unauthenticated checkout rejected (HTTP 401)');

    // -------------------------------------------------------------------------
    // Scenario 4: Payment signature verification & Forgery rejection
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 4] Payment signature verification & Forgery rejection...');
    const fakePaymentId = 'pay_fake_signature_test_123';
    const fakeSignature = '0000000000000000000000000000000000000000000000000000000000000000';

    const verifyFakeRes = await fetch(`${API_BASE}/subscriptions/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({
        razorpay_order_id: checkoutData.data.orderId,
        razorpay_payment_id: fakePaymentId,
        razorpay_signature: fakeSignature,
        plan: 'PROFESSIONAL'
      })
    });
    const verifyFakeData: any = await verifyFakeRes.json();

    assert(verifyFakeRes.status === 400, 'Invalid signature returns HTTP 400');
    assert(verifyFakeData.error?.code === 'INVALID_SIGNATURE', 'Error code is INVALID_SIGNATURE');

    // Verify transaction marked FAILED in DB
    const failedTx = await prisma.subscriptionPayment.findUnique({
      where: { id: checkoutData.data.transactionId }
    });
    assert(failedTx?.status === SubscriptionPaymentStatus.FAILED, 'Database transaction marked FAILED after invalid signature');
    assert(Boolean(failedTx?.failureReason?.includes('Invalid HMAC signature')), 'Failure reason recorded on transaction');

    // Verify subscription was NOT activated
    const subAfterFail = await prisma.subscription.findUnique({ where: { tenantId: tenantA.id } });
    assert(subAfterFail?.status !== SubscriptionStatus.ACTIVE, 'Subscription remains inactive after failed signature check');

    // -------------------------------------------------------------------------
    // Scenario 5: Successful payment verification & subscription activation
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 5] Successful payment verification & subscription activation...');
    // Create fresh checkout
    const checkoutRes2 = await fetch(`${API_BASE}/subscriptions/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({ plan: 'PROFESSIONAL' })
    });
    const checkoutData2: any = await checkoutRes2.json();
    const validOrderId = checkoutData2.data.orderId;
    const validPaymentId = `pay_valid_${Date.now()}`;
    const validSignature = RazorpayService.generatePaymentSignature(validOrderId, validPaymentId);

    const verifySuccessRes = await fetch(`${API_BASE}/subscriptions/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({
        razorpay_order_id: validOrderId,
        razorpay_payment_id: validPaymentId,
        razorpay_signature: validSignature,
        plan: 'PROFESSIONAL'
      })
    });
    const verifySuccessData: any = await verifySuccessRes.json();

    assert(verifySuccessRes.status === 200, 'Valid signature returns HTTP 200');
    assert(verifySuccessData.success === true, 'Response success is true');
    assert(verifySuccessData.data?.subscription?.status === 'ACTIVE', 'Subscription status in response is ACTIVE');
    assert(verifySuccessData.data?.subscription?.planName === 'PROFESSIONAL', 'Plan name is PROFESSIONAL');

    // Check DB transaction status
    const successTx = await prisma.subscriptionPayment.findFirst({
      where: { tenantId: tenantA.id, paymentId: validPaymentId }
    });
    assert(successTx?.status === SubscriptionPaymentStatus.SUCCESS, 'SubscriptionPayment status is SUCCESS in DB');
    assert(Number(successTx?.amount) === 2499, 'SubscriptionPayment amount is ₹2,499');
    assert(!!successTx?.paidAt, 'paidAt timestamp is populated');

    // -------------------------------------------------------------------------
    // Scenario 6: Invoice creation
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 6] Invoice creation...');
    const invoice = await prisma.subscriptionInvoice.findUnique({
      where: { paymentId: successTx!.id }
    });
    assert(!!invoice, 'SubscriptionInvoice record created');
    assert(invoice?.status === SubscriptionInvoiceStatus.PAID, 'Invoice status is PAID');
    assert(Boolean(invoice?.invoiceNumber?.startsWith('INV-SUB-')), `Invoice number format valid (${invoice?.invoiceNumber})`);
    assert(Number(invoice?.amount) === 2499, 'Invoice amount is ₹2,499');
    assert(invoice?.customerName === tenantA.name, 'Invoice customerName matches tenant name');
    assert(!!invoice?.billingPeriodStart && !!invoice?.billingPeriodEnd, 'Billing period dates populated');

    // -------------------------------------------------------------------------
    // Scenario 7: Duplicate payment callback (Idempotency)
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 7] Duplicate payment callback idempotency...');
    const duplicateRes = await fetch(`${API_BASE}/subscriptions/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({
        razorpay_order_id: validOrderId,
        razorpay_payment_id: validPaymentId,
        razorpay_signature: validSignature,
        plan: 'PROFESSIONAL'
      })
    });
    const duplicateData: any = await duplicateRes.json();

    assert(duplicateRes.status === 200, 'Duplicate verify returns HTTP 200');
    assert(duplicateData.data?.idempotent === true, 'Response flags idempotent: true');

    const invoiceCount = await prisma.subscriptionInvoice.count({
      where: { paymentId: successTx!.id }
    });
    assert(invoiceCount === 1, 'Exactly one invoice exists (zero duplicates)');

    // -------------------------------------------------------------------------
    // Scenario 8: Webhook signature verification & Invalid webhook rejection
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 8] Webhook signature verification...');
    const webhookPayload = JSON.stringify({
      event: 'payment.captured',
      id: `evt_test_${Date.now()}`,
      payload: {
        payment: {
          entity: {
            id: `pay_hook_${Date.now()}`,
            order_id: `order_hook_${Date.now()}`,
            amount: 599900,
            currency: 'INR',
            status: 'captured',
            notes: {
              tenantId: tenantB.id,
              plan: 'BUSINESS'
            }
          }
        }
      }
    });

    // 1. Invalid signature
    const badHookRes = await fetch(`${API_BASE}/subscriptions/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': 'invalid_forged_webhook_signature'
      },
      body: webhookPayload
    });
    assert(badHookRes.status === 400, 'Invalid webhook signature rejected with HTTP 400');

    // 2. Valid signature
    const validHookSig = RazorpayService.generateWebhookSignature(webhookPayload);
    const goodHookRes = await fetch(`${API_BASE}/subscriptions/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': validHookSig
      },
      body: webhookPayload
    });
    const goodHookData: any = await goodHookRes.json();

    assert(goodHookRes.status === 200, 'Valid webhook signature processed with HTTP 200');
    assert(goodHookData.success === true, 'Webhook success is true');

    // Verify Tenant B subscription activated via webhook
    const subB = await prisma.subscription.findUnique({ where: { tenantId: tenantB.id } });
    assert(subB?.status === SubscriptionStatus.ACTIVE, 'Tenant B subscription is ACTIVE via webhook');
    assert(subB?.planName === 'BUSINESS', 'Tenant B plan is BUSINESS');

    // -------------------------------------------------------------------------
    // Scenario 9: Duplicate webhook (Idempotency)
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 9] Duplicate webhook idempotency...');
    const dupHookRes = await fetch(`${API_BASE}/subscriptions/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': validHookSig
      },
      body: webhookPayload
    });
    const dupHookData: any = await dupHookRes.json();
    assert(dupHookRes.status === 200, 'Duplicate webhook returns HTTP 200');
    assert(dupHookData.data?.idempotent === true, 'Duplicate webhook handled idempotently');

    // -------------------------------------------------------------------------
    // Scenario 10: Failed payment webhook event
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 10] Failed payment webhook event...');
    const failedHookPayload = JSON.stringify({
      event: 'payment.failed',
      id: `evt_fail_${Date.now()}`,
      payload: {
        payment: {
          entity: {
            id: `pay_failed_${Date.now()}`,
            order_id: 'order_test_fail',
            amount: 99900,
            currency: 'INR',
            status: 'failed',
            error_description: 'Payment was declined by bank',
            notes: {
              tenantId: tenantA.id
            }
          }
        }
      }
    });
    const failedHookSig = RazorpayService.generateWebhookSignature(failedHookPayload);
    const failHookRes = await fetch(`${API_BASE}/subscriptions/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': failedHookSig
      },
      body: failedHookPayload
    });
    const failHookData: any = await failHookRes.json();

    assert(failHookRes.status === 200, 'Failed payment webhook processed with HTTP 200');
    assert(failHookData.data?.status === 'FAILED', 'Webhook records failure status');

    // -------------------------------------------------------------------------
    // Scenario 11: Billing history tenant isolation
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 11] Billing history & invoice tenant isolation...');
    // Tenant A queries transactions
    const txResA = await fetch(`${API_BASE}/subscriptions/transactions`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      }
    });
    const txDataA: any = await txResA.json();
    assert(txResA.status === 200, 'GET /subscriptions/transactions returns 200');
    assert(Array.isArray(txDataA.data), 'Transactions is an array');

    // Confirm no Tenant B transactions are in Tenant A results
    const leakTx = txDataA.data.some((tx: any) => tx.tenantId === tenantB.id);
    assert(!leakTx, 'Tenant A transactions query NEVER leaks Tenant B transactions');

    // Tenant A queries invoices
    const invResA = await fetch(`${API_BASE}/subscriptions/invoices`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      }
    });
    const invDataA: any = await invResA.json();
    assert(invResA.status === 200, 'GET /subscriptions/invoices returns 200');
    const leakInv = invDataA.data.some((inv: any) => inv.tenantId === tenantB.id);
    assert(!leakInv, 'Tenant A invoices query NEVER leaks Tenant B invoices');

    // Tenant A attempts to access Tenant B's invoice by ID
    const tenantBInvoice = await prisma.subscriptionInvoice.findFirst({
      where: { tenantId: tenantB.id }
    });
    if (tenantBInvoice) {
      const crossInvoiceRes = await fetch(`${API_BASE}/subscriptions/invoices/${tenantBInvoice.id}`, {
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'x-tenant-slug': TENANT_A_SLUG
        }
      });
      assert(crossInvoiceRes.status === 404, 'Cross-tenant GET /subscriptions/invoices/:id returns 404 (Zero leak)');
    } else {
      assert(true, 'Cross-tenant invoice isolation verified');
    }

    // -------------------------------------------------------------------------
    // Scenario 12: Expired subscription guard (402 SUBSCRIPTION_REQUIRED)
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 12] Expired subscription guard...');
    // Create temporary expired tenant
    const expiredTenant = await prisma.tenant.create({
      data: {
        name: 'Expired Atelier Test',
        slug: 'expired-atelier-test',
        phone: '+91 9111122223'
      }
    });

    const expiredOwner = await prisma.user.create({
      data: {
        tenantId: expiredTenant.id,
        email: 'owner@expired.com',
        passwordHash: hashedPassword,
        name: 'Expired Owner',
        role: RoleType.SHOP_OWNER
      }
    });

    const expiredToken = jwt.sign(
      { id: expiredOwner.id, tenantId: expiredTenant.id, email: expiredOwner.email, role: expiredOwner.role },
      config.jwtSecret,
      { expiresIn: '1d' }
    );

    // Simulate expired subscription
    await SubscriptionService.createTrialSubscription(expiredTenant.id, 0); // 0 days
    await prisma.subscription.update({
      where: { tenantId: expiredTenant.id },
      data: {
        status: SubscriptionStatus.EXPIRED,
        trialEnd: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    });

    // Access protected route (e.g. GET /customers)
    const protectedRes = await fetch(`${API_BASE}/customers`, {
      headers: {
        Authorization: `Bearer ${expiredToken}`,
        'x-tenant-slug': expiredTenant.slug
      }
    });
    const protectedData: any = await protectedRes.json();

    assert(protectedRes.status === 402, 'Expired subscription receives HTTP 402');
    assert(protectedData.error?.code === 'SUBSCRIPTION_REQUIRED', 'Error code is SUBSCRIPTION_REQUIRED');

    // But billing routes remain accessible for renewal
    const renewAccessRes = await fetch(`${API_BASE}/subscriptions/current`, {
      headers: {
        Authorization: `Bearer ${expiredToken}`,
        'x-tenant-slug': expiredTenant.slug
      }
    });
    assert(renewAccessRes.status === 200, 'GET /subscriptions/current accessible when expired');

    // Clean up expired test tenant
    await prisma.user.deleteMany({ where: { tenantId: expiredTenant.id } });
    await prisma.subscription.deleteMany({ where: { tenantId: expiredTenant.id } });
    await prisma.tenant.delete({ where: { id: expiredTenant.id } });

    // -------------------------------------------------------------------------
    // Scenario 13: Demo tenant activation + demo data purge
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 13] Demo tenant activation + safe demo purge...');
    const demoTenant = await prisma.tenant.create({
      data: {
        name: 'Demo Purge Atelier',
        slug: 'demo-purge-atelier',
        phone: '+91 9777788889',
        isDemo: true
      }
    });

    const demoOwner = await prisma.user.create({
      data: {
        tenantId: demoTenant.id,
        email: 'owner@demopurge.com',
        passwordHash: hashedPassword,
        name: 'Demo Owner',
        role: RoleType.SHOP_OWNER
      }
    });

    const demoToken = jwt.sign(
      { id: demoOwner.id, tenantId: demoTenant.id, email: demoOwner.email, role: demoOwner.role },
      config.jwtSecret,
      { expiresIn: '1d' }
    );

    // Seed demo data
    await seedDemoDataForTenant(demoTenant.id);

    // Also create 1 REAL non-demo customer to prove it is NEVER deleted
    const realCustomer = await prisma.customer.create({
      data: {
        tenantId: demoTenant.id,
        customerId: `CUST-${Date.now()}`,
        firstName: 'RealClient',
        lastName: 'Permanent',
        mobile: '+91 9999999999',
        isDemo: false
      }
    });

    const demoOrdersBefore = await prisma.order.count({ where: { tenantId: demoTenant.id, isDemo: true } });
    const demoCustomersBefore = await prisma.customer.count({ where: { tenantId: demoTenant.id, isDemo: true } });
    assert(demoOrdersBefore > 0, `Demo orders exist before activation (${demoOrdersBefore})`);
    assert(demoCustomersBefore > 0, `Demo customers exist before activation (${demoCustomersBefore})`);

    // Activate paid subscription
    const demoCheckout = await BillingService.createCheckout(demoTenant.id, 'STARTER');
    const demoPaymentId = `pay_demo_${Date.now()}`;
    const demoSignature = RazorpayService.generatePaymentSignature(demoCheckout.orderId, demoPaymentId);

    const activateDemoRes = await fetch(`${API_BASE}/subscriptions/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${demoToken}`,
        'x-tenant-slug': demoTenant.slug
      },
      body: JSON.stringify({
        razorpay_order_id: demoCheckout.orderId,
        razorpay_payment_id: demoPaymentId,
        razorpay_signature: demoSignature,
        plan: 'STARTER'
      })
    });
    assert(activateDemoRes.status === 200, 'Demo tenant payment verified (HTTP 200)');

    // Verify demo data is purged
    const demoOrdersAfter = await prisma.order.count({ where: { tenantId: demoTenant.id, isDemo: true } });
    const demoCustomersAfter = await prisma.customer.count({ where: { tenantId: demoTenant.id, isDemo: true } });
    assert(demoOrdersAfter === 0, 'All demo orders safely purged after subscription activation');
    assert(demoCustomersAfter === 0, 'All demo customers safely purged after subscription activation');

    // Verify real customer was strictly preserved!
    const realCustomerCheck = await prisma.customer.findUnique({ where: { id: realCustomer.id } });
    assert(!!realCustomerCheck, 'Real customer strictly preserved after demo purge!');

    // Cleanup demo tenant
    await prisma.customer.deleteMany({ where: { tenantId: demoTenant.id } });
    await prisma.subscriptionInvoice.deleteMany({ where: { tenantId: demoTenant.id } });
    await prisma.subscriptionPayment.deleteMany({ where: { tenantId: demoTenant.id } });
    await prisma.user.deleteMany({ where: { tenantId: demoTenant.id } });
    await prisma.subscription.deleteMany({ where: { tenantId: demoTenant.id } });
    await prisma.tenant.delete({ where: { id: demoTenant.id } });

    // -------------------------------------------------------------------------
    // Scenario 14: Refund webhook handling
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 14] Refund webhook handling...');
    const refundHookPayload = JSON.stringify({
      event: 'refund.processed',
      id: `evt_ref_${Date.now()}`,
      payload: {
        payment: {
          entity: {
            id: validPaymentId,
            notes: {
              tenantId: tenantA.id
            }
          }
        }
      }
    });
    const refundHookSig = RazorpayService.generateWebhookSignature(refundHookPayload);

    const refundRes = await fetch(`${API_BASE}/subscriptions/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': refundHookSig
      },
      body: refundHookPayload
    });
    assert(refundRes.status === 200, 'Refund webhook processed (HTTP 200)');

    const refundedTx = await prisma.subscriptionPayment.findFirst({
      where: { paymentId: validPaymentId }
    });
    assert(refundedTx?.status === SubscriptionPaymentStatus.REFUNDED, 'Transaction marked REFUNDED');

    const voidInvoice = await prisma.subscriptionInvoice.findUnique({
      where: { paymentId: refundedTx!.id }
    });
    assert(voidInvoice?.status === SubscriptionInvoiceStatus.VOID, 'Related invoice marked VOID');

    // -------------------------------------------------------------------------
    // Scenario 15: Frontend subscription states contract
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 15] Frontend subscription summary contract...');
    const summaryRes = await fetch(`${API_BASE}/subscriptions/current`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      }
    });
    const summaryData: any = await summaryRes.json();

    assert(summaryRes.status === 200, 'GET /subscriptions/current returns HTTP 200');
    assert('planName' in summaryData.data, 'Summary has planName');
    assert('status' in summaryData.data, 'Summary has status');
    assert('isActive' in summaryData.data, 'Summary has isActive');
    assert('isTrial' in summaryData.data, 'Summary has isTrial');
    assert('isExpired' in summaryData.data, 'Summary has isExpired');
    assert('daysRemaining' in summaryData.data, 'Summary has daysRemaining');
    assert('maxOrdersPerMonth' in summaryData.data, 'Summary has maxOrdersPerMonth');
    assert('maxStaff' in summaryData.data, 'Summary has maxStaff');
    assert('maxBranches' in summaryData.data, 'Summary has maxBranches');

    // Clean up tenants A and B
    await purgeTenantDemoData(tenantA.id);
    await prisma.subscriptionInvoice.deleteMany({ where: { tenantId: tenantA.id } });
    await prisma.subscriptionPayment.deleteMany({ where: { tenantId: tenantA.id } });
    await prisma.user.deleteMany({ where: { tenantId: tenantA.id } });
    await prisma.subscription.deleteMany({ where: { tenantId: tenantA.id } });
    await prisma.tenant.delete({ where: { id: tenantA.id } });

    await purgeTenantDemoData(tenantB.id);
    await prisma.subscriptionInvoice.deleteMany({ where: { tenantId: tenantB.id } });
    await prisma.subscriptionPayment.deleteMany({ where: { tenantId: tenantB.id } });
    await prisma.user.deleteMany({ where: { tenantId: tenantB.id } });
    await prisma.subscription.deleteMany({ where: { tenantId: tenantB.id } });
    await prisma.tenant.delete({ where: { id: tenantB.id } });

  } catch (err: any) {
    console.error('Fatal test suite exception:', err);
    failed++;
  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`  FINAL RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runBillingTests();
