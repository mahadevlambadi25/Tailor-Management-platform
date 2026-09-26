import { prisma } from '../src/core/prisma';
import bcrypt from 'bcryptjs';
import { subscriptionService } from '../src/modules/subscriptions/subscriptionService';
import { RazorpayService } from '../src/modules/subscriptions/razorpayService';
import { seedDemoDataForTenant, purgeTenantDemoData } from '../src/modules/demo/demoService';
import { SubscriptionStatus, RoleType } from '@prisma/client';
import { app } from '../src/app';
import http from 'http';

const API_BASE = 'http://localhost:5000/api/v1';

async function runSubscriptionArchitectureTests() {
  console.log('================================================================');
  console.log('    SUBSCRIPTION ARCHITECTURE & TRIAL LIFECYCLE TEST SUITE      ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;
  let localServer: any = null;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✔ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✖ FAIL: ${testName}`, detail || '');
      failed++;
    }
  }

  const TENANT_A_SLUG = 'sub-test-atelier-alpha';
  const TENANT_B_SLUG = 'sub-test-atelier-beta';
  let tenantA: any = null;
  let tenantB: any = null;
  let tokenA = '';
  let tokenB = '';

  try {
    // Check if server is running on 5000, if not start it
    try {
      await fetch('http://localhost:5000/api/v1/subscriptions/plans');
    } catch {
      console.log('[Setup] Starting local backend server on port 5000 for test suite...');
      localServer = http.createServer(app);
      await new Promise<void>((resolve) => localServer.listen(5000, resolve));
    }
    // -------------------------------------------------------------------------
    // Setup Test Tenants and Users
    // -------------------------------------------------------------------------
    console.log('[Setup] Preparing isolated test ateliers & accounts...');
    
    // Clean prior runs if any
    const existingA = await prisma.tenant.findUnique({ where: { slug: TENANT_A_SLUG } });
    if (existingA) {
      await purgeTenantDemoData(existingA.id);
      await prisma.user.deleteMany({ where: { tenantId: existingA.id } });
      await prisma.subscription.deleteMany({ where: { tenantId: existingA.id } });
      await prisma.tenant.delete({ where: { id: existingA.id } });
    }

    const existingB = await prisma.tenant.findUnique({ where: { slug: TENANT_B_SLUG } });
    if (existingB) {
      await purgeTenantDemoData(existingB.id);
      await prisma.user.deleteMany({ where: { tenantId: existingB.id } });
      await prisma.subscription.deleteMany({ where: { tenantId: existingB.id } });
      await prisma.tenant.delete({ where: { id: existingB.id } });
    }

    tenantA = await prisma.tenant.create({
      data: {
        name: 'Alpha Bespoke Atelier',
        slug: TENANT_A_SLUG,
        phone: '+91 9888877771',
        email: 'alpha@atelier.com',
        isDemo: true
      }
    });

    tenantB = await prisma.tenant.create({
      data: {
        name: 'Beta Haute Couture',
        slug: TENANT_B_SLUG,
        phone: '+91 9888877772',
        email: 'beta@atelier.com',
        isDemo: true
      }
    });

    const hashedPassword = await bcrypt.hash('TestPassword123!', 10);

    await prisma.user.create({
      data: {
        tenantId: tenantA.id,
        email: 'owner@alpha.com',
        passwordHash: hashedPassword,
        name: 'Alpha Owner',
        role: RoleType.SHOP_OWNER,
        isActive: true
      }
    });

    await prisma.user.create({
      data: {
        tenantId: tenantB.id,
        email: 'owner@beta.com',
        passwordHash: hashedPassword,
        name: 'Beta Owner',
        role: RoleType.SHOP_OWNER,
        isActive: true
      }
    });

    const garmentTypeA = await prisma.garmentType.create({
      data: {
        tenantId: tenantA.id,
        code: 'SUIT_2PC',
        name: 'Two Piece Suit',
        category: 'SUIT'
      }
    });

    // -------------------------------------------------------------------------
    // Test 1: Auto-provisioning of TRIAL subscription on new tenants
    // -------------------------------------------------------------------------
    console.log('\n[Test 1] Auto-provisioning TRIAL subscription with trialStart & trialEnd...');
    const subA = await subscriptionService.getTenantSubscription(tenantA.id);
    assert(!!subA, 'Subscription auto-created on demand');
    assert(subA.status === SubscriptionStatus.TRIAL, `Subscription status is TRIAL (actual: ${subA.status})`);
    assert(subA.planName === 'FREE_TRIAL', `Plan name defaults to FREE_TRIAL (actual: ${subA.planName})`);
    assert(!!subA.trialStart && !!subA.trialEnd, 'trialStart and trialEnd timestamps are populated');

    const durationDays = Math.round((new Date(subA.trialEnd!).getTime() - new Date(subA.trialStart!).getTime()) / (1000 * 60 * 60 * 24));
    assert(durationDays === 14, `Default trial duration is 14 days (actual: ${durationDays})`);

    // -------------------------------------------------------------------------
    // Test 2: Active trial evaluation & Login with unexpired trial
    // -------------------------------------------------------------------------
    console.log('\n[Test 2] Active trial status evaluation & login flow...');
    const evalActive = await subscriptionService.checkSubscriptionStatus(tenantA.id);
    assert(evalActive?.status === SubscriptionStatus.TRIAL, 'checkSubscriptionStatus keeps TRIAL when unexpired');
    assert(subscriptionService.isSubscriptionActive(evalActive), 'isSubscriptionActive returns true for valid trial');

    // Perform login
    const loginResA = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({
        email: 'owner@alpha.com',
        password: 'TestPassword123!'
      })
    });
    const loginDataA: any = await loginResA.json();

    assert(loginResA.status === 200 && !!loginDataA.data?.token, 'Login succeeds for tenant in TRIAL mode');
    tokenA = loginDataA.data.token;

    // Verify /subscriptions/current endpoint
    const currentSubRes = await fetch(`${API_BASE}/subscriptions/current`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      }
    });
    const currentSubData: any = await currentSubRes.json();
    assert(currentSubRes.status === 200, 'GET /subscriptions/current returns 200');
    assert(currentSubData.data?.status === 'TRIAL', 'GET /subscriptions/current reports TRIAL');
    assert(currentSubData.data?.isActive === true, 'GET /subscriptions/current reports isActive: true');
    assert(currentSubData.data?.daysRemaining >= 13, `Reports >= 13 days remaining (actual: ${currentSubData.data?.daysRemaining})`);

    // -------------------------------------------------------------------------
    // Test 3: Business operations allowed during valid trial
    // -------------------------------------------------------------------------
    console.log('\n[Test 3] Business operations allowed under valid trial...');
    const custRes = await fetch(`${API_BASE}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({
        firstName: 'Alok',
        lastName: 'Verma',
        mobile: '+91 9876543210',
        email: 'alok@client.com'
      })
    });
    const custData: any = await custRes.json();
    assert(custRes.status === 201 || custRes.status === 200, 'POST /customers succeeds during TRIAL');
    const customerId = custData.data?.id;

    const orderRes = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({
        customerId,
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
          {
            garmentTypeId: garmentTypeA.id,
            itemPrice: 15000
          }
        ]
      })
    });
    assert(orderRes.status === 201 || orderRes.status === 200, 'POST /orders succeeds during TRIAL');

    // -------------------------------------------------------------------------
    // Test 4: Idempotent on-access transition from TRIAL to EXPIRED
    // -------------------------------------------------------------------------
    console.log('\n[Test 4] Idempotent transition to EXPIRED when trialEnd < now...');
    // Artificially age the trialEnd to yesterday
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.subscription.update({
      where: { tenantId: tenantA.id },
      data: { trialEnd: yesterday }
    });

    const evalExpired = await subscriptionService.checkSubscriptionStatus(tenantA.id);
    assert(evalExpired?.status === SubscriptionStatus.EXPIRED, `checkSubscriptionStatus transitioned status to EXPIRED (actual: ${evalExpired?.status})`);
    assert(subscriptionService.isSubscriptionActive(evalExpired) === false, 'isSubscriptionActive returns false for EXPIRED');

    // Verify DB record was updated idempotently
    const dbSub = await prisma.subscription.findUnique({ where: { tenantId: tenantA.id } });
    assert(dbSub?.status === SubscriptionStatus.EXPIRED, 'Database record reflects EXPIRED status');

    // -------------------------------------------------------------------------
    // Test 5: HTTP 402 SUBSCRIPTION_REQUIRED on business operations for EXPIRED tenant
    // -------------------------------------------------------------------------
    console.log('\n[Test 5] HTTP 402 SUBSCRIPTION_REQUIRED enforcement on business endpoints...');
    
    // 5a. POST /orders
    const orderExpiredRes = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({
        customerId,
        deliveryDate: new Date().toISOString(),
        items: [{ garmentType: 'SHIRT', price: 2000 }]
      })
    });
    const orderExpiredData: any = await orderExpiredRes.json();
    assert(orderExpiredRes.status === 402, 'POST /orders rejected with HTTP 402 for expired tenant');
    assert(orderExpiredData.error?.code === 'SUBSCRIPTION_REQUIRED', `Error code is SUBSCRIPTION_REQUIRED (actual: ${orderExpiredData.error?.code})`);
    assert(orderExpiredData.error?.details?.status === 'EXPIRED', `Details status returned is EXPIRED (actual: ${orderExpiredData.error?.details?.status})`);

    // 5b. POST /customers
    const customerExpiredRes = await fetch(`${API_BASE}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({
        firstName: 'Blocked',
        lastName: 'Client',
        mobile: '+91 9999900000'
      })
    });
    assert(customerExpiredRes.status === 402, 'POST /customers rejected with HTTP 402 for expired tenant');

    // 5c. GET /reports/owner-dashboard
    const reportExpiredRes = await fetch(`${API_BASE}/reports/owner-dashboard`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      }
    });
    assert(reportExpiredRes.status === 402, 'GET /reports/owner-dashboard rejected with HTTP 402 for expired tenant');

    // 5d. POST /payments
    const paymentExpiredRes = await fetch(`${API_BASE}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({
        orderId: 'dummy-order-id',
        amount: 1000,
        paymentMethod: 'CASH'
      })
    });
    assert(paymentExpiredRes.status === 402, 'POST /payments rejected with HTTP 402 for expired tenant');

    // -------------------------------------------------------------------------
    // Test 6: Expired users are NEVER blocked from login or checking identity
    // -------------------------------------------------------------------------
    console.log('\n[Test 6] Expired users can login and check /auth/me...');
    const loginExpiredRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({
        email: 'owner@alpha.com',
        password: 'TestPassword123!'
      })
    });
    const loginExpiredData: any = await loginExpiredRes.json();
    assert(loginExpiredRes.status === 200, 'POST /auth/login returns 200 for user of expired tenant');

    const meExpiredRes = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${loginExpiredData.data?.token}`,
        'x-tenant-slug': TENANT_A_SLUG
      }
    });
    assert(meExpiredRes.status === 200, 'GET /auth/me returns 200 for user of expired tenant');

    // -------------------------------------------------------------------------
    // Test 7: Subscription management endpoints remain accessible when expired
    // -------------------------------------------------------------------------
    console.log('\n[Test 7] Accessible subscription and tenant info endpoints when expired...');
    const tenantRes = await fetch(`${API_BASE}/tenants`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      }
    });
    const tenantData: any = await tenantRes.json();
    assert(tenantRes.status === 200, 'GET /tenants returns 200 when subscription is expired');
    assert(tenantData.data?.subscription?.status === 'EXPIRED', 'GET /tenants returns up-to-date EXPIRED status');

    const subCurrentResExpired = await fetch(`${API_BASE}/subscriptions/current`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      }
    });
    const subCurrentDataExpired: any = await subCurrentResExpired.json();
    assert(subCurrentResExpired.status === 200, 'GET /subscriptions/current returns 200 when expired');
    assert(subCurrentDataExpired.data?.status === 'EXPIRED', 'GET /subscriptions/current returns status EXPIRED');
    assert(subCurrentDataExpired.data?.isExpired === true, 'GET /subscriptions/current returns isExpired: true');

    const plansRes = await fetch(`${API_BASE}/subscriptions/plans`);
    const plansData: any = await plansRes.json();
    assert(plansRes.status === 200, 'GET /subscriptions/plans returns 200 without authentication');
    assert(!!plansData.data?.STARTER && !!plansData.data?.PROFESSIONAL, 'Returns plan tiers metadata');

    // -------------------------------------------------------------------------
    // Test 8: Demo data and real data are PRESERVED across trial expiration
    // -------------------------------------------------------------------------
    console.log('\n[Test 8] Preservation of demo data & real data across trial expiration...');
    // Seed demo data for Tenant A
    const statsSeeded = await seedDemoDataForTenant(tenantA.id);
    assert(statsSeeded.hasDemoData === true, 'Demo data seeded into Tenant A');

    // Re-verify that trial expiration did NOT delete any demo or real records
    const demoOrders = await prisma.order.count({ where: { tenantId: tenantA.id, isDemo: true } });
    const realOrders = await prisma.order.count({ where: { tenantId: tenantA.id, isDemo: false } });
    const demoCusts = await prisma.customer.count({ where: { tenantId: tenantA.id, isDemo: true } });
    const realCusts = await prisma.customer.count({ where: { tenantId: tenantA.id, isDemo: false } });

    assert(demoOrders >= 3, `Demo orders preserved across expiration (found: ${demoOrders})`);
    assert(realOrders >= 1, `Real orders preserved across expiration (found: ${realOrders})`);
    assert(demoCusts >= 3, `Demo customers preserved across expiration (found: ${demoCusts})`);
    assert(realCusts >= 1, `Real customers preserved across expiration (found: ${realCusts})`);

    // -------------------------------------------------------------------------
    // Test 9: Active subscription activation allows business operations again
    // -------------------------------------------------------------------------
    console.log('\n[Test 9] Subscription renewal / activation to ACTIVE allows business operations...');
    const activationResult = await subscriptionService.activateSubscription(tenantA.id, 'PROFESSIONAL', {
      clearDemo: false // As required: no demo data deletion without verified payment confirmation flow
    });

    assert(activationResult.subscription.status === SubscriptionStatus.ACTIVE, 'activateSubscription updates status to ACTIVE');
    assert(subscriptionService.isSubscriptionActive(activationResult.subscription) === true, 'isSubscriptionActive returns true for ACTIVE');

    // Now business operations should succeed again
    const postOrderAgain = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({
        customerId,
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        items: [{ garmentTypeId: garmentTypeA.id, itemPrice: 8000 }]
      })
    });
    assert(postOrderAgain.status === 201 || postOrderAgain.status === 200, 'POST /orders succeeds after activation to ACTIVE');

    // -------------------------------------------------------------------------
    // Test 10: Multi-tenant isolation for subscriptions
    // -------------------------------------------------------------------------
    console.log('\n[Test 10] Multi-tenant subscription isolation...');
    const loginResB = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-slug': TENANT_B_SLUG
      },
      body: JSON.stringify({
        email: 'owner@beta.com',
        password: 'TestPassword123!'
      })
    });
    const loginDataB: any = await loginResB.json();
    tokenB = loginDataB.data?.token;

    // Tenant B queries their own subscription
    const subCurrentB = await fetch(`${API_BASE}/subscriptions/current`, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
        'x-tenant-slug': TENANT_B_SLUG
      }
    });
    const subDataB: any = await subCurrentB.json();
    assert(subDataB.data?.status === 'TRIAL', 'Tenant B is in independent TRIAL');

    // Tenant B should not be affected by Tenant A being ACTIVE
    const subADb = await prisma.subscription.findUnique({ where: { tenantId: tenantA.id } });
    const subBDb = await prisma.subscription.findUnique({ where: { tenantId: tenantB.id } });
    assert(subADb?.status === SubscriptionStatus.ACTIVE, 'Tenant A is ACTIVE');
    assert(subBDb?.status === SubscriptionStatus.TRIAL, 'Tenant B is independently in TRIAL');

    // -------------------------------------------------------------------------
    // Test 11: Production hardening of /dev-simulate endpoint
    // -------------------------------------------------------------------------
    console.log('\n[Test 11] Production hardening of dev-simulate...');
    // Test dev-simulate in current mode: succeeds
    const devSimRes = await fetch(`${API_BASE}/subscriptions/dev-simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({
        status: 'TRIAL'
      })
    });
    assert(devSimRes.status === 200, 'POST /dev-simulate succeeds in development');

    // Call service directly simulating NODE_ENV='production'
    let prodBlocked = false;
    try {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        await subscriptionService.devSimulateStatus(tenantA.id, SubscriptionStatus.EXPIRED);
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    } catch (err: any) {
      if (err.message?.includes('strictly disabled in production')) {
        prodBlocked = true;
      }
    }
    assert(prodBlocked, 'devSimulateStatus strictly throws error when NODE_ENV === "production"');

    // -------------------------------------------------------------------------
    // Test 12: Razorpay SaaS Subscription Checkout Order Creation (Step 1)
    // -------------------------------------------------------------------------
    console.log('\n[Test 12] Razorpay SaaS Checkout Order Creation (Step 1)...');

    // 12.1 Unauthenticated request rejected
    const unauthCheckout = await fetch(`${API_BASE}/subscriptions/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({ plan: 'STARTER' })
    });
    assert(unauthCheckout.status === 401, 'POST /subscriptions/checkout rejects unauthenticated request (401)');

    // 12.2 Missing or invalid plan rejected
    const invalidPlanRes = await fetch(`${API_BASE}/subscriptions/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({ plan: 'NON_EXISTENT_PLAN_XYZ' })
    });
    const invalidPlanData: any = await invalidPlanRes.json();
    assert(
      invalidPlanRes.status === 400 && invalidPlanData.error?.code === 'INVALID_PLAN',
      'POST /subscriptions/checkout rejects non-existent plan with 400 INVALID_PLAN'
    );

    // 12.3 FREE_TRIAL checkout rejected
    const freeTrialCheckoutRes = await fetch(`${API_BASE}/subscriptions/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({ plan: 'FREE_TRIAL' })
    });
    assert(freeTrialCheckoutRes.status === 400, 'POST /subscriptions/checkout rejects FREE_TRIAL (paid plans only)');

    // 12.4 Authenticated checkout order creation
    const subBeforeCheckout = await prisma.subscription.findUnique({ where: { tenantId: tenantA.id } });
    const checkoutRes = await fetch(`${API_BASE}/subscriptions/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({ plan: 'STARTER' })
    });
    assert(checkoutRes.status === 200, 'POST /subscriptions/checkout returns HTTP 200');

    const checkoutText = await checkoutRes.text();
    const checkoutData = JSON.parse(checkoutText);
    assert(checkoutData.success === true, 'Checkout response success is true');
    assert(typeof checkoutData.data?.orderId === 'string' && checkoutData.data.orderId.startsWith('order_'), 'Returns valid Razorpay orderId');
    assert(checkoutData.data?.amount === 99900, 'Returns correct server-side amount in paise for STARTER (99900)');
    assert(checkoutData.data?.currency === 'INR', 'Returns correct currency (INR)');
    assert(typeof checkoutData.data?.keyId === 'string' && checkoutData.data.keyId.length > 0, 'Returns public keyId');
    assert(checkoutData.data?.plan === 'STARTER', 'Returns requested plan name');

    // 12.5 Secret protection
    assert(!checkoutText.includes('placeholder_secret') && !checkoutText.includes('razorpayKeySecret') && checkoutData.data?.keySecret === undefined, 'Never exposes RAZORPAY_KEY_SECRET in response');

    // 12.6 Frontend amount manipulation protection
    const manipulatedRes = await fetch(`${API_BASE}/subscriptions/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({ plan: 'PROFESSIONAL', amount: 100 }) // Attempting client-side amount override
    });
    const manipulatedData: any = await manipulatedRes.json();
    assert(manipulatedData.data?.amount === 249900, 'Frontend amount manipulation ignored; server calculated 249900 for PROFESSIONAL');

    // 12.7 Tenant spoofing protection
    const spoofRes = await fetch(`${API_BASE}/subscriptions/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({ plan: 'ENTERPRISE', tenantId: tenantB.id }) // Attempting to spoof Tenant B
    });
    const spoofData: any = await spoofRes.json();
    assert(spoofData.success === true, 'Checkout succeeds using authenticated tenant context');
    const subBCheck = await prisma.subscription.findUnique({ where: { tenantId: tenantB.id } });
    assert(subBCheck?.status === SubscriptionStatus.TRIAL, 'Tenant B remains untouched by spoofing attempt');

    // 12.8 Subscription status NOT activated & demo data NOT purged
    const subAfterCheckout = await prisma.subscription.findUnique({ where: { tenantId: tenantA.id } });
    assert(subAfterCheckout?.status === subBeforeCheckout?.status, 'Subscription status remains unchanged after checkout alone (never activated before payment/webhook)');

    // -------------------------------------------------------------------------
    // Test 13: Razorpay Payment Signature Verification & Activation (Step 2)
    // -------------------------------------------------------------------------
    console.log('\n[Test 13] Razorpay Payment Signature Verification & Activation (Step 2)...');

    // 13.1 Missing required payment verification parameters rejected (400)
    const emptyVerifyRes = await fetch(`${API_BASE}/subscriptions/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({})
    });
    assert(emptyVerifyRes.status === 400, 'POST /subscriptions/verify-payment rejects missing parameters (400)');

    // 13.2 Invalid payment signature rejected (400) and does NOT activate subscription
    const badSigVerifyRes = await fetch(`${API_BASE}/subscriptions/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({
        razorpay_order_id: 'order_test_fake_123',
        razorpay_payment_id: 'pay_test_fake_123',
        razorpay_signature: '0000000000000000000000000000000000000000000000000000000000000000',
        plan: 'PROFESSIONAL'
      })
    });
    const badSigData: any = await badSigVerifyRes.json();
    assert(badSigVerifyRes.status === 400 && badSigData.error?.code === 'INVALID_SIGNATURE', 'POST /subscriptions/verify-payment rejects forged/invalid signature');

    // 13.3 Seed demo data + real customer for Tenant A before verified activation
    await seedDemoDataForTenant(tenantA.id);
    const realCustomerA = await prisma.customer.create({
      data: {
        customerId: `CUST-REAL-${Date.now()}-A`,
        tenantId: tenantA.id,
        firstName: 'Real VIP',
        lastName: 'Customer A',
        mobile: '+91 9999111122',
        isDemo: false
      }
    });
    const demoCountBeforeVerify = await prisma.customer.count({ where: { tenantId: tenantA.id, isDemo: true } });
    assert(demoCountBeforeVerify > 0, 'Demo customers seeded prior to payment verification');

    // 13.4 Valid payment signature activates correct subscription
    const orderIdA = 'order_valid_atelier_001';
    const paymentIdA = 'pay_valid_checkout_001';
    const validSigA = RazorpayService.generatePaymentSignature(orderIdA, paymentIdA);

    const validVerifyRes = await fetch(`${API_BASE}/subscriptions/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({
        razorpay_order_id: orderIdA,
        razorpay_payment_id: paymentIdA,
        razorpay_signature: validSigA,
        plan: 'PROFESSIONAL'
      })
    });
    assert(validVerifyRes.status === 200, 'POST /subscriptions/verify-payment returns 200 on valid signature');
    const validVerifyData: any = await validVerifyRes.json();
    assert(validVerifyData.success === true, 'Verification response success is true');

    // Verify DB state for Tenant A
    const subAVerified = await prisma.subscription.findUnique({ where: { tenantId: tenantA.id } });
    assert(subAVerified?.status === SubscriptionStatus.ACTIVE, 'Tenant A subscription is ACTIVE');
    assert(subAVerified?.planName === 'PROFESSIONAL', 'Plan is set to PROFESSIONAL');
    assert(subAVerified?.paymentProvider === 'razorpay', 'Payment provider recorded as razorpay');
    assert(subAVerified?.providerSubscriptionId === paymentIdA, 'Provider payment ID stored correctly');

    // 13.5 Demo data is purged only after confirmed successful activation
    const demoCountAfterVerify = await prisma.customer.count({ where: { tenantId: tenantA.id, isDemo: true } });
    assert(demoCountAfterVerify === 0, 'Tenant A demo data successfully purged after verified payment');

    // 13.6 Real customer data strictly preserved
    const realCustomerCheckA = await prisma.customer.findUnique({ where: { id: realCustomerA.id } });
    assert(!!realCustomerCheckA, 'Real customer data strictly preserved across payment activation');

    // 13.7 Idempotency: duplicate verify call succeeds idempotently without re-purging or error
    const duplicateVerifyRes = await fetch(`${API_BASE}/subscriptions/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({
        razorpay_order_id: orderIdA,
        razorpay_payment_id: paymentIdA,
        razorpay_signature: validSigA,
        plan: 'PROFESSIONAL'
      })
    });
    const duplicateVerifyData: any = await duplicateVerifyRes.json();
    assert(duplicateVerifyRes.status === 200 && duplicateVerifyData.idempotent === true, 'Duplicate payment verification is idempotent');

    // 13.8 Tenant isolation: Tenant A cannot activate Tenant B's subscription
    const crossTenantVerifyRes = await fetch(`${API_BASE}/subscriptions/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
        'x-tenant-slug': TENANT_A_SLUG
      },
      body: JSON.stringify({
        tenantId: tenantB.id, // Attacker tries to pass Tenant B
        razorpay_order_id: 'order_spoof_001',
        razorpay_payment_id: 'pay_spoof_001',
        razorpay_signature: RazorpayService.generatePaymentSignature('order_spoof_001', 'pay_spoof_001'),
        plan: 'ENTERPRISE'
      })
    });
    assert(crossTenantVerifyRes.status === 200, 'Request processed using authenticated context');
    const subBAfterSpoof = await prisma.subscription.findUnique({ where: { tenantId: tenantB.id } });
    assert(subBAfterSpoof?.status === SubscriptionStatus.TRIAL, 'Tenant B subscription remains TRIAL (not activated by Tenant A)');

    // -------------------------------------------------------------------------
    // Test 14: Razorpay Webhook Processing, Idempotency & Security (Step 2)
    // -------------------------------------------------------------------------
    console.log('\n[Test 14] Razorpay Webhook Processing, Idempotency & Security (Step 2)...');

    // 14.1 Webhook without signature header rejected (400)
    const noSigWebhookRes = await fetch(`${API_BASE}/subscriptions/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'order.paid' })
    });
    assert(noSigWebhookRes.status === 400, 'POST /subscriptions/webhook rejects missing signature header (400)');

    // 14.2 Webhook with forged signature rejected (400)
    const forgedWebhookRes = await fetch(`${API_BASE}/subscriptions/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': '0000000000000000000000000000000000000000000000000000000000000000'
      },
      body: JSON.stringify({ event: 'order.paid', notes: { tenantId: tenantB.id } })
    });
    assert(forgedWebhookRes.status === 400, 'POST /subscriptions/webhook rejects invalid signature (400)');

    // 14.3 Seed demo data + real customer for Tenant B
    await seedDemoDataForTenant(tenantB.id);
    const realCustomerB = await prisma.customer.create({
      data: {
        customerId: `CUST-REAL-${Date.now()}-B`,
        tenantId: tenantB.id,
        firstName: 'Real VIP',
        lastName: 'Customer B',
        mobile: '+91 9999333344',
        isDemo: false
      }
    });

    // 14.4 Failed payment webhook does NOT activate subscription
    const failEventPayload = JSON.stringify({
      entity: 'event',
      id: `evt_fail_${Date.now()}`,
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_failed_001',
            status: 'failed',
            error_description: 'Card declined by issuing bank',
            notes: { tenantId: tenantB.id }
          }
        }
      }
    });
    const failWebhookSig = RazorpayService.generateWebhookSignature(failEventPayload);
    const failWebhookRes = await fetch(`${API_BASE}/subscriptions/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': failWebhookSig
      },
      body: failEventPayload
    });
    assert(failWebhookRes.status === 200, 'Failed payment webhook acknowledged');
    const subBFailCheck = await prisma.subscription.findUnique({ where: { tenantId: tenantB.id } });
    assert(subBFailCheck?.status !== SubscriptionStatus.ACTIVE, 'Failed payment webhook does NOT activate subscription (remains non-ACTIVE)');

    // Demo data for Tenant B preserved despite failure event
    const demoBAfterFail = await prisma.customer.count({ where: { tenantId: tenantB.id, isDemo: true } });
    assert(demoBAfterFail > 0, 'Demo data for Tenant B preserved after failed payment webhook');

    // 14.5 Successful payment webhook activates correct subscription & purges demo data
    const succWebhookEventId = `evt_succ_${Date.now()}`;
    const succPaymentId = `pay_webhook_succ_${Date.now()}`;
    const succEventPayload = JSON.stringify({
      entity: 'event',
      id: succWebhookEventId,
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: succPaymentId,
            order_id: 'order_webhook_001',
            status: 'captured',
            amount: 599900,
            currency: 'INR',
            notes: {
              tenantId: tenantB.id,
              plan: 'ENTERPRISE'
            }
          }
        }
      }
    });
    const succWebhookSig = RazorpayService.generateWebhookSignature(succEventPayload);
    const succWebhookRes = await fetch(`${API_BASE}/subscriptions/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': succWebhookSig
      },
      body: succEventPayload
    });
    assert(succWebhookRes.status === 200, 'POST /subscriptions/webhook returns 200 on valid signature');

    // Verify Tenant B subscription activated to ENTERPRISE
    const subBActive = await prisma.subscription.findUnique({ where: { tenantId: tenantB.id } });
    assert(subBActive?.status === SubscriptionStatus.ACTIVE, 'Tenant B subscription is ACTIVE via webhook');
    assert(subBActive?.planName === 'ENTERPRISE', 'Tenant B plan is ENTERPRISE');
    assert(subBActive?.providerSubscriptionId === succPaymentId, 'Provider payment ID stored correctly');

    // Demo data for Tenant B purged
    const demoBAfterSucc = await prisma.customer.count({ where: { tenantId: tenantB.id, isDemo: true } });
    assert(demoBAfterSucc === 0, 'Tenant B demo data purged after successful webhook activation');

    // Real customer B preserved
    const realCustomerCheckB = await prisma.customer.findUnique({ where: { id: realCustomerB.id } });
    assert(!!realCustomerCheckB, 'Tenant B real customer preserved after webhook activation');

    // 14.6 Duplicate webhook event does not activate twice (Idempotency)
    const dupWebhookRes = await fetch(`${API_BASE}/subscriptions/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': succWebhookSig
      },
      body: succEventPayload
    });
    const dupWebhookData: any = await dupWebhookRes.json();
    assert(dupWebhookRes.status === 200 && dupWebhookData.idempotent === true, 'Duplicate webhook event is idempotent (does not activate twice)');


  } catch (err: any) {
    console.error('Test Suite encountered fatal exception:', err.message);
    failed++;
  } finally {
    // Clean up test tenants
    if (tenantA) {
      await purgeTenantDemoData(tenantA.id).catch(() => {});
      await prisma.user.deleteMany({ where: { tenantId: tenantA.id } }).catch(() => {});
      await prisma.subscription.deleteMany({ where: { tenantId: tenantA.id } }).catch(() => {});
      await prisma.orderItem.deleteMany({ where: { tenantId: tenantA.id } }).catch(() => {});
      await prisma.order.deleteMany({ where: { tenantId: tenantA.id } }).catch(() => {});
      await prisma.garmentType.deleteMany({ where: { tenantId: tenantA.id } }).catch(() => {});
      await prisma.customer.deleteMany({ where: { tenantId: tenantA.id } }).catch(() => {});
      await prisma.tenant.delete({ where: { id: tenantA.id } }).catch(() => {});
    }
    if (tenantB) {
      await purgeTenantDemoData(tenantB.id).catch(() => {});
      await prisma.user.deleteMany({ where: { tenantId: tenantB.id } }).catch(() => {});
      await prisma.subscription.deleteMany({ where: { tenantId: tenantB.id } }).catch(() => {});
      await prisma.tenant.delete({ where: { id: tenantB.id } }).catch(() => {});
    }
    if (localServer) {
      localServer.close();
    }
  }

  console.log('\n================================================================');
  console.log(`  FINAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSubscriptionArchitectureTests()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
