import http from 'http';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/core/prisma';
import { config } from '../src/config';
import { app } from '../src/app';
import { NudgeService } from '../src/modules/conversion/nudgeService';
import { SampleDataService } from '../src/modules/conversion/sampleDataService';
import { RoleType } from '@prisma/client';

const PORT = 5055;
const BASE_URL = `http://localhost:${PORT}`;

async function runConversionE2ETests() {
  console.log('===============================================================');
  console.log('  CONVERSION V1 COMPREHENSIVE E2E VERIFICATION TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;
  let localServer: http.Server | null = null;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✔ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✖ FAIL: ${testName}`, detail || '');
      failed++;
    }
  }

  try {
    localServer = http.createServer(app);
    await new Promise<void>((resolve) => localServer!.listen(PORT, resolve));
    console.log(`Server started on port ${PORT}\n`);

    // =========================================================================
    // STEP 1: CONVERSION CONFIG & FEATURE FLAG
    // =========================================================================
    console.log('[STEP 1] Testing Conversion Configuration & Feature Flags...');
    const configRes = await fetch(`${BASE_URL}/api/v1/conversion/config`);
    const configData: any = await configRes.json();
    assert(configRes.status === 200, 'GET /conversion/config returns HTTP 200');
    assert(configData.success === true, 'Config response success is true');
    assert(configData.data?.conversionV1 === true, 'CONVERSION_V1 feature flag is enabled');
    assert(configData.data?.pricing?.STARTER?.annualPriceInInr === 9990, 'Starter annual price is ₹9,990');
    assert(configData.data?.pricing?.PROFESSIONAL?.annualPriceInInr === 24990, 'Professional annual price is ₹24,990');
    assert(configData.data?.pricing?.BUSINESS?.annualPriceInInr === 59990, 'Business annual price is ₹59,990');

    // =========================================================================
    // STEP 2: NEW TRIAL TENANT REGISTRATION & SAMPLE DATA SEEDING
    // =========================================================================
    console.log('\n[STEP 2] Testing New Trial Tenant Signup & Automatic Sample Data...');
    const testEmail = `owner.${Date.now()}@example.com`;
    const testPassword = 'Password@123';

    const signupRes = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Reshma Tailor',
        email: testEmail,
        password: testPassword,
        confirmPassword: testPassword,
      }),
    });
    const signupData: any = await signupRes.json();
    assert(signupRes.status === 201, 'Signup returns HTTP 201 Created', JSON.stringify(signupData));
    const token = signupData.data?.token;
    assert(typeof token === 'string' && token.length > 20, 'Auth token received on signup');
    const testSlug = signupData.data?.user?.tenant?.slug;

    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // Verify sample data in database
    const tenant = await prisma.tenant.findUnique({
      where: { slug: testSlug },
      include: {
        customers: true,
        orders: true,
        users: true,
        subscription: true,
      },
    });

    assert(tenant !== null, 'Tenant record created in DB');
    assert(tenant?.onboardingCompleted === false, 'Tenant onboardingCompleted is initially false');

    const sampleCustomers = tenant?.customers.filter((c: any) => c.isSample) || [];
    assert(sampleCustomers.length === 0, `Clean tenant has 0 sample customers (found ${sampleCustomers.length})`);
    assert(tenant?.customers.length === 0, `Clean tenant starts with 0 customers (found ${tenant?.customers.length})`);

    const sampleOrders = tenant?.orders.filter((o: any) => o.isSample) || [];
    assert(sampleOrders.length === 0, `Clean tenant has 0 sample orders (found ${sampleOrders.length})`);
    assert(tenant?.orders.length === 0, `Clean tenant starts with 0 orders (found ${tenant?.orders.length})`);

    // Verify clean production queue: 0 sample production jobs
    const sampleJobs = await prisma.productionJob.findMany({
      where: {
        tenantId: tenant!.id,
        orderItem: { order: { isSample: true } },
      },
    });
    assert(sampleJobs.length === 0, 'Clean tenant starts with 0 sample production jobs');

    // Verify 0 sample staff created; exactly 1 initial user (shop owner)
    const sampleStaff = tenant?.users.filter((u: any) => u.isSample) || [];
    assert(sampleStaff.length === 0, `Clean tenant has 0 sample staff (found ${sampleStaff.length})`);
    assert(tenant?.users.length === 1, `Clean tenant has exactly 1 initial user (owner)`);

    // =========================================================================
    // STEP 3: POST-SIGNUP ONBOARDING
    // =========================================================================
    console.log('\n[STEP 3] Testing Post-Signup Onboarding...');
    const onboardingRes = await fetch(`${BASE_URL}/api/v1/conversion/onboarding`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        shopType: 'Boutique',
        teamSize: '2 to 5',
        shopCount: 'One',
        skipped: false,
      }),
    });
    const onboardingData: any = await onboardingRes.json();
    assert(onboardingRes.status === 200, 'POST /conversion/onboarding returns HTTP 200');
    assert(onboardingData.data?.completed === true, 'Onboarding marked completed');

    const updatedTenant = await prisma.tenant.findUnique({ where: { slug: testSlug } });
    assert(updatedTenant?.shopType === 'Boutique', 'Tenant shopType saved as Boutique');
    assert(updatedTenant?.teamSize === '2 to 5', 'Tenant teamSize saved as 2 to 5');
    assert(updatedTenant?.shopCount === 'One', 'Tenant shopCount saved as One');

    // =========================================================================
    // STEP 4: SAMPLE DATA ISOLATION (LIMITS & CHECKLIST)
    // =========================================================================
    console.log('\n[STEP 4] Testing Sample Data Isolation (Limits & Checklist)...');
    const progressRes = await fetch(`${BASE_URL}/api/v1/conversion/upgrade/progress`, {
      headers: authHeaders,
    });
    const progressData: any = await progressRes.json();
    assert(progressRes.status === 200, 'GET /upgrade/progress returns HTTP 200');
    assert(
      progressData.data?.customerCount === 0,
      `Real customer count is 0 in clean workspace (found ${progressData.data?.customerCount})`
    );
    assert(
      progressData.data?.orderCount === 0,
      `Real order count is 0 in clean workspace (found ${progressData.data?.orderCount})`
    );
    assert(progressData.data?.staffCount === 0, 'Only non-owner staff counted in progress (0 initially)');

    const checklistRes = await fetch(`${BASE_URL}/api/v1/conversion/checklist`, {
      headers: authHeaders,
    });
    const checklistData: any = await checklistRes.json();
    assert(checklistRes.status === 200, 'GET /checklist returns HTTP 200');
    assert(checklistData.data?.step1_addCustomer === false, 'Checklist step 1 is incomplete');
    assert(checklistData.data?.step2_saveMeasurements === false, 'Checklist step 2 is incomplete');
    assert(checklistData.data?.step3_createOrder === false, 'Checklist step 3 is incomplete');
    assert(checklistData.data?.step4_moveStage === false, 'Checklist step 4 is incomplete');
    assert(checklistData.data?.step5_inviteTeam === false, 'Checklist step 5 is incomplete');

    // =========================================================================
    // STEP 5: REAL CUSTOMER CREATION & STEP 1 COMPLETION
    // =========================================================================
    console.log('\n[STEP 5] Testing First Real Customer Creation...');
    const custRes = await fetch(`${BASE_URL}/api/v1/customers`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        firstName: 'Real',
        lastName: 'Customer',
        mobile: '9999000001',
        gender: 'FEMALE',
      }),
    });
    const custData: any = await custRes.json();
    assert(custRes.status === 201, 'POST /customers creates real customer with HTTP 201', JSON.stringify(custData));
    const realCustomerId = custData.data?.id;

    // Verify sample status reports zero sample data and recognizes real customer
    const sampleStatus = await SampleDataService.getStatus(tenant!.id);
    assert(sampleStatus.hasSampleData === false, 'Sample status confirms no sample data in clean workspace');
    assert(sampleStatus.realCustomers === 1, 'SampleDataService recognizes first real customer');

    // Verify checklist step 1 is completed
    const checklistRes2 = await fetch(`${BASE_URL}/api/v1/conversion/checklist`, {
      headers: authHeaders,
    });
    const checklistData2: any = await checklistRes2.json();
    assert(checklistData2.data?.step1_addCustomer === true, 'Checklist Step 1 (add_first_customer) is completed');

    // =========================================================================
    // STEP 6: REAL MEASUREMENT & STEP 2 COMPLETION
    // =========================================================================
    console.log('\n[STEP 6] Testing First Real Measurement...');
    // Ensure garment type exists
    let garment = await prisma.garmentType.findFirst({ where: { tenantId: tenant!.id } });
    if (!garment) {
      garment = await prisma.garmentType.create({
        data: {
          tenantId: tenant!.id,
          name: 'Blouse',
          code: `BL-${Date.now().toString().slice(-4)}`,
          category: 'WOMEN',
          defaultPrice: 1000,
        },
      });
    }

    const measRes = await fetch(`${BASE_URL}/api/v1/measurements`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        customerId: realCustomerId,
        garmentTypeId: garment.id,
        values: { chest: 36, waist: 30, length: 15 },
      }),
    });
    assert(measRes.status === 200 || measRes.status === 201, `POST /measurements succeeds (${measRes.status})`);

    const checklistRes3 = await fetch(`${BASE_URL}/api/v1/conversion/checklist`, {
      headers: authHeaders,
    });
    const checklistData3: any = await checklistRes3.json();
    assert(checklistData3.data?.step2_saveMeasurements === true, 'Checklist Step 2 (save_measurements) is completed');

    // =========================================================================
    // STEP 7: REAL ORDER CREATION & AHA EVENT TRIGGER
    // =========================================================================
    console.log('\n[STEP 7] Testing First Real Order & AHA Event...');
    const dueDate = new Date(Date.now() + 5 * 86400000).toISOString();
    const orderRes = await fetch(`${BASE_URL}/api/v1/orders`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        customerId: realCustomerId,
        deliveryDate: dueDate,
        items: [
          {
            garmentTypeId: garment.id,
            itemPrice: 1000,
            stitchingCharge: 500,
            quantity: 1,
          },
        ],
      }),
    });
    const orderData: any = await orderRes.json();
    assert(orderRes.status === 201, 'POST /orders creates real order with HTTP 201', JSON.stringify(orderData));
    const realOrderId = orderData.data?.id;

    // Verify checklist step 3 is completed
    const checklistRes4 = await fetch(`${BASE_URL}/api/v1/conversion/checklist`, {
      headers: authHeaders,
    });
    const checklistData4: any = await checklistRes4.json();
    assert(checklistData4.data?.step3_createOrder === true, 'Checklist Step 3 (create_order) is completed');

    // Verify AHA event was tracked in FunnelEvent table
    const ahaEvent = await prisma.funnelEvent.findFirst({
      where: { shopId: tenant!.id, event: 'aha_reached' },
    });
    assert(ahaEvent !== null, 'FunnelEvent "aha_reached" was recorded in database');

    // Move order to next stage via production job
    const prodJob = await prisma.productionJob.findFirst({
      where: { tenantId: tenant!.id, orderItem: { orderId: realOrderId } },
    });
    assert(prodJob !== null, 'Production job exists for the order item');

    const moveRes = await fetch(`${BASE_URL}/api/v1/production/jobs/${prodJob!.id}/stage`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        stage: 'CUTTING',
      }),
    });
    assert(moveRes.status === 200, 'Order moved to CUTTING stage with HTTP 200');

    // Verify checklist step 4 is completed
    const checklistRes5 = await fetch(`${BASE_URL}/api/v1/conversion/checklist`, {
      headers: authHeaders,
    });
    const checklistData5: any = await checklistRes5.json();
    assert(checklistData5.data?.step4_moveStage === true, 'Checklist Step 4 (move_order_stage) is completed');

    // =========================================================================
    // STEP 8: CLEAR SAMPLE DATA (SAFE NO-OP ON CLEAN TENANT)
    // =========================================================================
    console.log('\n[STEP 8] Testing Clear Sample Data Safety (Real Data Preserved)...');
    const clearResult = await SampleDataService.clearSampleData(tenant!.id);
    assert(clearResult.deletedCustomers === 0, 'Zero sample customers deleted on clean tenant (found 0)');
    assert(clearResult.deletedOrders === 0, 'Zero sample orders deleted on clean tenant (found 0)');

    // Verify in DB that real customer and real order are intact
    const remainingCust = await prisma.customer.findUnique({ where: { id: realCustomerId } });
    assert(remainingCust !== null, 'REAL customer was NOT deleted by clear sample data');

    const remainingOrder = await prisma.order.findUnique({ where: { id: realOrderId } });
    assert(remainingOrder !== null, 'REAL order was NOT deleted by clear sample data');

    const sampleCountAfter = await prisma.customer.count({
      where: { tenantId: tenant!.id, isSample: true },
    });
    assert(sampleCountAfter === 0, 'Zero sample customers remain');

    // =========================================================================
    // STEP 9: TEAM INVITE & STAFF ACCOUNT CREATION
    // =========================================================================
    console.log('\n[STEP 9] Testing Team Invite & Staff Account Creation...');
    const inviteRes = await fetch(`${BASE_URL}/api/v1/conversion/team/invite`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Master Ramesh',
        phone: '9876500002',
        role: 'CUTTER',
      }),
    });
    assert(inviteRes.status === 201, 'POST /conversion/team/invite returns HTTP 201');

    // Verify staff user created in DB with CUTTER role
    const invitedStaff = await prisma.user.findFirst({
      where: { tenantId: tenant!.id, phone: '9876500002' },
    });
    assert(invitedStaff !== null, 'Invited staff user created in database');
    assert(invitedStaff?.role === 'CUTTER', 'Invited staff assigned CUTTER role');

    // Verify checklist step 5 is completed
    const checklistRes6 = await fetch(`${BASE_URL}/api/v1/conversion/checklist`, {
      headers: authHeaders,
    });
    const checklistData6: any = await checklistRes6.json();
    assert(checklistData6.data?.step5_inviteTeam === true, 'Checklist Step 5 (invite_team) is completed');
    assert(checklistData6.data?.allCompleted === true, 'All 5 checklist steps completed!');

    // =========================================================================
    // STEP 10: CUSTOMER IMPORT & DUPLICATE DETECTION
    // =========================================================================
    console.log('\n[STEP 10] Testing Customer Import & Duplicate Phone Handling...');
    const importRows = [
      { name: 'Priya Sharma', phone: '9111222333', notes: 'Wedding order', chest: '34', waist: '28' },
      { name: 'Sunita Rao', phone: '9999000001', notes: 'Duplicate phone test' },
      { name: 'Kavita Patil', phone: '9444555666', notes: 'Alterations' },
    ];

    const previewRes = await fetch(`${BASE_URL}/api/v1/conversion/import/preview`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        rows: importRows,
      }),
    });
    const previewData: any = await previewRes.json();
    assert(previewRes.status === 200, 'POST /conversion/import/preview returns HTTP 200');
    assert(previewData.data?.totalRows === 3, 'Preview identifies 3 rows');
    assert(previewData.data?.duplicateCount === 1, 'Duplicate phone identified against existing real customer');

    const commitRes = await fetch(`${BASE_URL}/api/v1/conversion/import/commit`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        validRows: previewData.data.validRows,
      }),
    });
    const commitData: any = await commitRes.json();
    assert(commitRes.status === 200, 'POST /conversion/import/commit returns HTTP 200');
    assert(commitData.data?.importedCount === 2, 'Imported exactly 2 non-duplicate customers');

    // Verify imported customers are REAL records (isSample: false)
    const priya = await prisma.customer.findFirst({
      where: { tenantId: tenant!.id, firstName: 'Priya' },
    });
    assert(priya !== null && priya.isSample === false, 'Imported customer created with isSample: false');

    // =========================================================================
    // STEP 11: NUDGE SCHEDULER & IDEMPOTENCY
    // =========================================================================
    console.log('\n[STEP 11] Testing Nudge Rules & Idempotency...');
    // Trigger nudge evaluation
    await NudgeService.evaluateShopNudges(tenant!.id);

    const nudgesSent = await prisma.nudgeLog.findMany({
      where: { shopId: tenant!.id },
    });
    assert(nudgesSent.length <= 1, 'At most 1 nudge sent per day for the shop');

    // Second evaluation on the same day should send 0 additional nudges (1/day max rule)
    await NudgeService.evaluateShopNudges(tenant!.id);
    const nudgesSentAfter = await prisma.nudgeLog.findMany({
      where: { shopId: tenant!.id },
    });
    assert(nudgesSentAfter.length === nudgesSent.length, 'Idempotency & 1-per-day rule: no second nudge sent today');

    // =========================================================================
    // STEP 12: PAYMENT CHECKOUT & SIMULATION
    // =========================================================================
    console.log('\n[STEP 12] Testing Checkout & Payment Simulation...');
    const checkoutRes = await fetch(`${BASE_URL}/api/v1/conversion/checkout`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        plan: 'PROFESSIONAL',
        cycle: 'ANNUAL',
      }),
    });
    const checkoutData: any = await checkoutRes.json();
    assert(checkoutRes.status === 200, 'POST /conversion/checkout returns HTTP 200');
    assert(!!checkoutData.data?.orderId, 'Razorpay checkout order created');
    assert(checkoutData.data?.provider === 'razorpay', 'Provider is razorpay');

    // Verify Payment via subscriptions/verify endpoint
    const rzpOrderId = checkoutData.data.orderId;
    const testSecret = config.razorpayKeySecret || 'test_secret';
    const fakePaymentId = `pay_test_${Date.now()}`;
    const generatedSignature = crypto
      .createHmac('sha256', testSecret)
      .update(`${rzpOrderId}|${fakePaymentId}`)
      .digest('hex');

    const verifyRes = await fetch(`${BASE_URL}/api/v1/subscriptions/verify`, {
      method: 'POST',
      headers: { ...authHeaders, 'x-tenant-slug': testSlug },
      body: JSON.stringify({
        razorpay_order_id: rzpOrderId,
        razorpay_payment_id: fakePaymentId,
        razorpay_signature: generatedSignature,
        plan: 'PROFESSIONAL',
      }),
    });
    const verifyData: any = await verifyRes.json();
    assert(verifyRes.status === 200 && verifyData.success, 'Payment verified via /subscriptions/verify');
    assert(verifyData.data?.subscription?.status === 'ACTIVE', 'Payment marked subscription as ACTIVE');

    const subAfterSuccess = await prisma.subscription.findFirst({
      where: { tenantId: tenant!.id },
    });
    assert(subAfterSuccess?.status === 'ACTIVE', 'Subscription status updated to ACTIVE in DB');

    // =========================================================================
    // STEP 13: EXPIRED TRIAL READ-ONLY MODE
    // =========================================================================
    console.log('\n[STEP 13] Testing Expired Trial Read-Only Mode (HTTP 402)...');
    // Set subscription to EXPIRED with past trial end date
    await prisma.subscription.update({
      where: { id: subAfterSuccess!.id },
      data: {
        status: 'EXPIRED',
        trialEnd: new Date(Date.now() - 86400000),
      },
    });

    // 1. GET requests should SUCCEED
    const getCustRes = await fetch(`${BASE_URL}/api/v1/customers`, {
      headers: authHeaders,
    });
    assert(getCustRes.status === 200, 'Expired trial: GET /customers succeeds (HTTP 200)');

    const getOrdersRes = await fetch(`${BASE_URL}/api/v1/orders`, {
      headers: authHeaders,
    });
    assert(getOrdersRes.status === 200, 'Expired trial: GET /orders succeeds (HTTP 200)');

    // 2. POST (mutating) should be BLOCKED with HTTP 402
    const blockedCustRes = await fetch(`${BASE_URL}/api/v1/customers`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        firstName: 'Blocked',
        lastName: 'Customer',
        mobile: '9999000099',
      }),
    });
    const blockedCustData: any = await blockedCustRes.json();
    assert(blockedCustRes.status === 402, 'Expired trial: POST /customers blocked with HTTP 402 Payment Required');
    assert(
      blockedCustData.error?.code === 'READONLY_TRIAL_EXPIRED',
      'Blocked action returns error code READONLY_TRIAL_EXPIRED'
    );

    // 3. Payment restores write access immediately
    await prisma.subscription.update({
      where: { id: subAfterSuccess!.id },
      data: {
        status: 'ACTIVE',
      },
    });

    const unblockedCustRes = await fetch(`${BASE_URL}/api/v1/customers`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        firstName: 'Restored',
        lastName: 'Customer',
        mobile: '9999000099',
      }),
    });
    assert(unblockedCustRes.status === 201, 'Payment restores write access: POST /customers succeeds (HTTP 201)');

    // =========================================================================
    // STEP 14: TENANT ISOLATION
    // =========================================================================
    console.log('\n[STEP 14] Testing Tenant Isolation on Conversion Entities...');
    // Create tenant 2
    const t2Email = `owner2.${Date.now()}@example.com`;
    const t2SignupRes = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Second Owner',
        email: t2Email,
        password: 'Password@123',
        confirmPassword: 'Password@123',
      }),
    });
    const t2SignupData: any = await t2SignupRes.json();
    const t2Token = t2SignupData.data?.token;

    // Tenant 2 checking customers and orders - strict isolation from Tenant 1
    const t2CustRes = await fetch(`${BASE_URL}/api/v1/customers`, {
      headers: { Authorization: `Bearer ${t2Token}` },
    });
    const t2CustData: any = await t2CustRes.json();
    assert(t2CustRes.status === 200, 'Tenant 2 can query their own customers');
    assert(
      (t2CustData.data?.customers?.length || t2CustData.data?.length || 0) === 0,
      'Tenant 2 sees ZERO customers from Tenant 1 (strict tenant isolation)'
    );

    const t2OrderRes = await fetch(`${BASE_URL}/api/v1/orders`, {
      headers: { Authorization: `Bearer ${t2Token}` },
    });
    const t2OrderData: any = await t2OrderRes.json();
    assert(t2OrderRes.status === 200, 'Tenant 2 can query their own orders');
    assert(
      (t2OrderData.data?.orders?.length || t2OrderData.data?.length || 0) === 0,
      'Tenant 2 sees ZERO orders from Tenant 1 (strict tenant isolation)'
    );

    // =========================================================================
    // STEP 15: PRESERVATION OF EXISTING TENANT DATA
    // =========================================================================
    console.log('\n[STEP 15] Verifying Existing Tenant Data Preservation...');
    const existingRoyal = await prisma.tenant.findUnique({
      where: { slug: 'royal-bespoke' },
      include: { customers: true, orders: true },
    });
    if (existingRoyal) {
      assert(existingRoyal.customers.length > 0, 'Royal Bespoke existing customers remain untouched and preserved');
      assert(existingRoyal.orders.length > 0, 'Royal Bespoke existing orders remain untouched and preserved');
    } else {
      console.log('  ℹ royal-bespoke slug not present in DB; skipping slug check.');
    }

    // =========================================================================
    // STEP 16: SUPER-ADMIN FUNNEL TELEMETRY
    // =========================================================================
    console.log('\n[STEP 16] Testing Super-Admin Funnel Telemetry (/admin/funnel)...');
    // Normal user trying to access admin funnel should be 403 Forbidden
    const forbiddenFunnelRes = await fetch(`${BASE_URL}/api/v1/conversion/admin/funnel`, {
      headers: authHeaders,
    });
    assert(forbiddenFunnelRes.status === 403, 'Normal tenant user blocked from /admin/funnel with HTTP 403');

    // Admin token
    const testAdminToken = jwt.sign(
      { userId: 'admin-tester', role: RoleType.SAAS_OWNER, email: 'admin@system.local' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    const adminFunnelRes = await fetch(`${BASE_URL}/api/v1/conversion/admin/funnel`, {
      headers: { Authorization: `Bearer ${testAdminToken}` },
    });
    const adminFunnelData: any = await adminFunnelRes.json();
    assert(adminFunnelRes.status === 200, 'SAAS_OWNER successfully accesses /admin/funnel');
    assert(Array.isArray(adminFunnelData.data?.steps), 'Funnel steps array returned');
    assert(
      adminFunnelData.data?.steps.some((f: any) => f.key === 'signup_completed'),
      'Funnel includes signup_completed event'
    );

    console.log('\n===============================================================');
    console.log(`  E2E RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    if (localServer) {
      localServer.close();
    }
    await prisma.$disconnect();
  }
}

runConversionE2ETests();
