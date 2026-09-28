import { app } from '../src/app';
import { prisma } from '../src/core/prisma';
import { config } from '../src/config';
import { SubscriptionService, SUBSCRIPTION_PLANS } from '../src/modules/subscriptions/subscriptionService';
import { BillingService } from '../src/modules/subscriptions/billingService';
import { RazorpayService } from '../src/modules/subscriptions/razorpayService';
import { RoleType, OrderStatus, PaymentStatus, PaymentMethod, UnitSystem, ProductionStageName } from '@prisma/client';
import http from 'http';
import crypto from 'crypto';

async function runCleanTenantLifecycleTest() {
  console.log('================================================================');
  console.log('  VERIFY CLEAN TENANT LIFECYCLE & DEMO ISOLATION TEST SUITE    ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✔ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✖ FAIL: ${testName}`, detail ? `-> ${detail}` : '');
      failed++;
    }
  }

  // Spin up ephemeral test server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  const TEST_EMAIL = `ramesh.clean.${Date.now()}@example.com`;
  let authToken = '';
  let tenantId = '';
  let tenantSlug = '';
  let userId = '';
  let branchId = '';
  let customerId = '';
  let orderId = '';
  let measurementId = '';
  let paymentId = '';
  let garmentTypeId = '';

  try {
    // -------------------------------------------------------------
    // Step 1 & 2: Register a completely new user
    // -------------------------------------------------------------
    console.log('\n--- Step 1 & 2: Register a completely new user & verify tenant ---');
    const registerRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ramesh Tailors',
        email: TEST_EMAIL,
        password: 'Password123!',
        confirmPassword: 'Password123!'
      })
    });

    const registerData: any = await registerRes.json();
    assert((registerRes.status === 200 || registerRes.status === 201) && registerData.success, 'New tenant registered successfully', JSON.stringify(registerData));

    authToken = registerData.data.token;
    userId = registerData.data.user.id;
    tenantId = registerData.data.user.tenant.id;
    tenantSlug = registerData.data.user.tenant.slug;
    branchId = registerData.data.user.branch.id;

    assert(!!tenantId, `Tenant created with ID: ${tenantId}`);
    assert(tenantSlug.startsWith('ramesh-tailors'), `Tenant slug correctly generated: ${tenantSlug}`);

    const tenantRecord = await prisma.tenant.findUnique({ where: { id: tenantId } });
    assert(tenantRecord !== null, 'Tenant record found in database');
    assert(tenantRecord?.isDemo === false, 'Tenant isDemo flag is FALSE (Clean Workspace)');

    // -------------------------------------------------------------
    // Step 3: Verify subscription starts as TRIAL
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Verify subscription starts as TRIAL ---');
    const subscription = await prisma.subscription.findUnique({ where: { tenantId } });
    assert(subscription !== null, 'Subscription record created for new tenant');
    assert(subscription?.status === 'TRIAL', `Subscription status is TRIAL (actual: ${subscription?.status})`);
    assert(subscription?.planName === 'FREE_TRIAL', `Subscription plan is FREE_TRIAL (actual: ${subscription?.planName})`);
    assert(subscription?.trialUsed === true, 'Trial flag trialUsed is true');
    assert(subscription?.trialStart !== null, 'Trial trialStart is populated');
    assert(subscription?.trialEnd !== null, 'Trial trialEnd is populated (14 days)');

    if (subscription?.trialStart && subscription?.trialEnd) {
      const durationDays = Math.round(
        (new Date(subscription.trialEnd).getTime() - new Date(subscription.trialStart).getTime()) / (1000 * 60 * 60 * 24)
      );
      assert(durationDays === 14, `Trial duration is exactly 14 days (actual: ${durationDays} days)`);
    }

    // -------------------------------------------------------------
    // Step 4: Verify workspace has ZERO demo/sample records
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Verify workspace has ZERO demo/sample records ---');
    const customersCount = await prisma.customer.count({ where: { tenantId } });
    const ordersCount = await prisma.order.count({ where: { tenantId } });
    const measurementsCount = await prisma.customerMeasurement.count({ where: { tenantId } });
    const orderItemsCount = await prisma.orderItem.count({ where: { tenantId } });
    const productionJobsCount = await prisma.productionJob.count({ where: { tenantId } });
    const paymentsCount = await prisma.payment.count({ where: { tenantId } });

    assert(customersCount === 0, `Initial Customers count is 0 (actual: ${customersCount})`);
    assert(ordersCount === 0, `Initial Orders count is 0 (actual: ${ordersCount})`);
    assert(measurementsCount === 0, `Initial Measurements count is 0 (actual: ${measurementsCount})`);
    assert(orderItemsCount === 0, `Initial OrderItems count is 0 (actual: ${orderItemsCount})`);
    assert(productionJobsCount === 0, `Initial ProductionJobs count is 0 (actual: ${productionJobsCount})`);
    assert(paymentsCount === 0, `Initial Payments count is 0 (actual: ${paymentsCount})`);

    // Verify tenant API response
    const tenantApiRes = await fetch(`${baseUrl}/tenants`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'x-tenant-slug': tenantSlug
      }
    });
    const tenantApiData: any = await tenantApiRes.json();
    assert(tenantApiRes.status === 200, 'Fetched tenant profile via API');
    assert(tenantApiData.data.isDemo === false, 'Tenant API reports isDemo === false');
    assert(tenantApiData.data.demoStats?.hasDemoData === false, 'Tenant API reports hasDemoData === false');

    // Create a Garment Type for this workspace
    const garment = await prisma.garmentType.create({
      data: {
        tenantId,
        name: 'Wedding Bespoke Shirt',
        code: 'WBS-01',
        category: 'Men',
        defaultPrice: 1500
      }
    });
    garmentTypeId = garment.id;

    // -------------------------------------------------------------
    // Step 5: Add a real customer
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Add a real customer ---');
    const realCustomer = await prisma.customer.create({
      data: {
        tenantId,
        customerId: `CUST-${Date.now().toString().slice(-4)}`,
        firstName: 'Rahul',
        lastName: 'Sharma',
        mobile: '9876543210',
        email: 'rahul.sharma@example.com',
        isDemo: false
      }
    });
    customerId = realCustomer.id;
    assert(!!customerId, `Real Customer created: Rahul Sharma (${customerId})`);

    // -------------------------------------------------------------
    // Step 6: Add a real measurement
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Add a real measurement ---');
    const realMeasurement = await prisma.customerMeasurement.create({
      data: {
        tenantId,
        customerId,
        garmentTypeId,
        name: 'Wedding Shirt Measurements',
        unit: UnitSystem.INCHES,
        versions: {
          create: {
            versionNumber: 1,
            values: { chest: 40, waist: 32 },
            notes: 'Master tailored fit profile'
          }
        }
      },
      include: { versions: true }
    });
    measurementId = realMeasurement.id;
    assert(!!measurementId, `Real Measurement created: Shirt 40", Pant 32" (${measurementId})`);

    // -------------------------------------------------------------
    // Step 7, 8 & 9: Add a real order, production job & customer payment
    // -------------------------------------------------------------
    console.log('\n--- Step 7, 8 & 9: Add real order, production job & in-shop payment ---');
    const realOrder: any = await prisma.order.create({
      data: {
        tenantId,
        branchId,
        customerId,
        orderNumber: `ORD-${Date.now().toString().slice(-4)}`,
        status: OrderStatus.IN_PROGRESS,
        priority: 'STANDARD',
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        totalAmount: 1500,
        netAmount: 1500,
        paidAmount: 500,
        balanceAmount: 1000,
        paymentStatus: PaymentStatus.PARTIAL,
        isDemo: false,
        items: {
          create: {
            tenantId,
            garmentTypeId,
            itemPrice: 1500,
            totalItemPrice: 1500,
            quantity: 1,
            status: ProductionStageName.STITCHING,
            productionJob: {
              create: {
                tenantId,
                currentStage: ProductionStageName.STITCHING,
                notes: 'Master tailor stitching in progress'
              }
            }
          }
        },
        payments: {
          create: {
            tenantId,
            customerId,
            amount: 500,
            paymentMethod: PaymentMethod.CASH,
            referenceNumber: `REC-ADV-${Date.now().toString().slice(-4)}`
          }
        }
      },
      include: {
        items: {
          include: { productionJob: true }
        },
        payments: true
      }
    });
    orderId = realOrder.id;
    paymentId = realOrder.payments[0].id;

    assert(!!orderId, `Real Order created: Wedding Shirt (#${realOrder.orderNumber})`);
    assert(realOrder.items.length === 1, 'Real OrderItem created');
    assert(!!realOrder.items[0].productionJob, 'Real ProductionJob created');
    assert(!!paymentId, `Real Customer Payment created: ₹500 (${paymentId})`);

    // -------------------------------------------------------------
    // Step 10 & 11: Upgrade to a paid plan using billing flow
    // -------------------------------------------------------------
    console.log('\n--- Step 10 & 11: Upgrade to STARTER plan via Razorpay flow ---');
    // 1. Create Checkout
    const checkoutRes = await fetch(`${baseUrl}/subscriptions/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'x-tenant-slug': tenantSlug
      },
      body: JSON.stringify({ plan: 'STARTER' })
    });
    const checkoutData: any = await checkoutRes.json();
    assert(checkoutRes.status === 200 && checkoutData.success, 'Checkout order created via API');
    const rzpOrderId = checkoutData.data.orderId;
    assert(!!rzpOrderId, `Razorpay order ID received: ${rzpOrderId}`);

    // 2. Generate valid HMAC-SHA256 signature
    const testSecret = config.razorpayKeySecret || 'test_secret';
    const fakePaymentId = `pay_test_${crypto.randomBytes(6).toString('hex')}`;
    const generatedSignature = crypto
      .createHmac('sha256', testSecret)
      .update(`${rzpOrderId}|${fakePaymentId}`)
      .digest('hex');

    // 3. Verify Payment
    const verifyRes = await fetch(`${baseUrl}/subscriptions/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'x-tenant-slug': tenantSlug
      },
      body: JSON.stringify({
        razorpay_order_id: rzpOrderId,
        razorpay_payment_id: fakePaymentId,
        razorpay_signature: generatedSignature,
        plan: 'STARTER'
      })
    });
    const verifyData: any = await verifyRes.json();
    assert(verifyRes.status === 200 && verifyData.success, 'Payment verified and confirmed successfully');
    assert(verifyData.data.subscription.status === 'ACTIVE', 'Subscription status updated to ACTIVE');

    // -------------------------------------------------------------
    // Step 12: Verify subscription in DB is ACTIVE
    // -------------------------------------------------------------
    console.log('\n--- Step 12: Verify subscription becomes ACTIVE ---');
    const activeSub = await prisma.subscription.findUnique({ where: { tenantId } });
    assert(activeSub?.status === 'ACTIVE', `Subscription status in DB is ACTIVE (actual: ${activeSub?.status})`);
    assert(activeSub?.planName === 'STARTER', `Subscription planName is STARTER (actual: ${activeSub?.planName})`);

    // Verify invoice created
    const invoices = await prisma.subscriptionInvoice.findMany({ where: { tenantId } });
    assert(invoices.length === 1, `1 Subscription invoice generated (invoice #${invoices[0]?.invoiceNumber})`);
    assert(invoices[0]?.status === 'PAID', 'Invoice status is PAID');

    // -------------------------------------------------------------
    // Step 13 & 14: CRITICAL DATA SAFETY VERIFICATION
    // All real records MUST STILL EXIST after subscription upgrade!
    // -------------------------------------------------------------
    console.log('\n--- Step 13 & 14: CRITICAL DATA SAFETY VERIFICATION ---');
    const survivingCustomer = await prisma.customer.findUnique({ where: { id: customerId } });
    assert(survivingCustomer !== null, 'Real Customer Rahul Sharma SURVIVED subscription activation');
    assert(survivingCustomer?.firstName === 'Rahul' && survivingCustomer?.lastName === 'Sharma', 'Customer name intact');

    const survivingMeasurement = await prisma.customerMeasurement.findUnique({
      where: { id: measurementId },
      include: { versions: true }
    });
    assert(survivingMeasurement !== null, 'Real Measurement SURVIVED subscription activation');
    assert(survivingMeasurement?.versions.length === 1, 'Measurement versions intact');
    assert((survivingMeasurement?.versions[0]?.values as any)?.chest === 40, 'Measurement values intact (chest: 40, waist: 32)');

    const survivingOrder: any = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { productionJob: true }
        },
        payments: true
      }
    });
    assert(survivingOrder !== null, 'Real Order Wedding Shirt SURVIVED subscription activation');
    assert(Number(survivingOrder?.totalAmount) === 1500, 'Order financial amounts intact (total: ₹1500)');
    assert(survivingOrder?.items.length === 1, 'Order items intact (1 item)');
    assert(!!survivingOrder?.items[0]?.productionJob, 'Order production job intact');

    const survivingPayment = await prisma.payment.findUnique({ where: { id: paymentId } });
    assert(survivingPayment !== null, 'Real Customer Payment ₹500 SURVIVED subscription activation');
    assert(Number(survivingPayment?.amount) === 500, 'Payment amount intact (₹500)');

    // Check counts: EXACTLY 1 of each real record, 0 deleted
    const finalCustomersCount = await prisma.customer.count({ where: { tenantId } });
    const finalOrdersCount = await prisma.order.count({ where: { tenantId } });
    const finalMeasurementsCount = await prisma.customerMeasurement.count({ where: { tenantId } });
    const finalPaymentsCount = await prisma.payment.count({ where: { tenantId } });

    assert(finalCustomersCount === 1, `Exactly 1 Customer remains (count: ${finalCustomersCount})`);
    assert(finalOrdersCount === 1, `Exactly 1 Order remains (count: ${finalOrdersCount})`);
    assert(finalMeasurementsCount === 1, `Exactly 1 Measurement remains (count: ${finalMeasurementsCount})`);
    assert(finalPaymentsCount === 1, `Exactly 1 Payment remains (count: ${finalPaymentsCount})`);

    // -------------------------------------------------------------
    // Step 15 & 16: Verify tenant is not marked as DEMO & no DEMO badge
    // -------------------------------------------------------------
    console.log('\n--- Step 15 & 16: Verify tenant is not marked as DEMO & no DEMO badge ---');
    const finalTenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    assert(finalTenant?.isDemo === false, 'Tenant isDemo remains FALSE after subscription activation');

    const finalTenantApiRes = await fetch(`${baseUrl}/tenants`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'x-tenant-slug': tenantSlug
      }
    });
    const finalTenantData: any = await finalTenantApiRes.json();
    assert(finalTenantData.data.isDemo === false, 'API confirms tenant isDemo === false');
    assert(finalTenantData.data.demoStats?.hasDemoData === false, 'API confirms demoStats.hasDemoData === false');

    // Simulate frontend badge condition:
    // (import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_ACCOUNTS === 'true') && tenant?.isDemo && tenant?.demoStats?.hasDemoData
    const isDev = true; // Even in dev mode...
    const showDemoBadge = isDev && finalTenantData.data.isDemo && finalTenantData.data.demoStats?.hasDemoData;
    assert(!showDemoBadge, 'DEMO badge is NOT shown for normal real customer (evaluated: false)');

    // -------------------------------------------------------------
    // Step 17: Verify existing 4 demo accounts STILL EXIST and WORK
    // -------------------------------------------------------------
    console.log('\n--- Step 17: Verify existing 4 demo accounts are UNTOUCHED ---');
    const demo1 = await prisma.user.findFirst({ where: { email: 'owner@royalbespoke.com' } });
    assert(demo1 !== null, 'Demo Account 1 exists: owner@royalbespoke.com');

    const demo2 = await prisma.user.findFirst({ where: { email: 'owner@demo-tailors.com' } });
    assert(demo2 !== null, 'Demo Account 2 exists: owner@demo-tailors.com');

    const demo3 = await prisma.user.findFirst({ where: { email: 'receptionist@royalbespoke.com' } });
    assert(demo3 !== null, 'Demo Account 3 exists: receptionist@royalbespoke.com');

    const demo4 = await prisma.user.findFirst({ where: { email: 'tailor@royalbespoke.com' } });
    assert(demo4 !== null, 'Demo Account 4 exists: tailor@royalbespoke.com');

    // Verify royal-bespoke demo tenant still has demo data
    const royalTenant = await prisma.tenant.findUnique({ where: { slug: 'royal-bespoke' } });
    assert(royalTenant !== null, 'Royal Bespoke demo tenant exists');
    assert(royalTenant?.isDemo === true, 'Royal Bespoke has isDemo === true');

    const royalOrders = await prisma.order.count({ where: { tenantId: royalTenant?.id } });
    const royalCustomers = await prisma.customer.count({ where: { tenantId: royalTenant?.id } });
    assert(royalOrders > 0, `Royal Bespoke has ${royalOrders} orders (demo data preserved)`);
    assert(royalCustomers > 0, `Royal Bespoke has ${royalCustomers} customers (demo data preserved)`);

    // Verify demo-tailors tenant still exists
    const demoTailorsTenant = await prisma.tenant.findUnique({ where: { slug: 'demo-tailors' } });
    assert(demoTailorsTenant !== null, 'Demo Tailors tenant exists');
    assert(demoTailorsTenant?.isDemo === true, 'Demo Tailors has isDemo === true');

    // Clean up only our test tenant
    console.log('\n--- Cleaning up ephemeral test tenant ---');
    await prisma.subscriptionInvoice.deleteMany({ where: { tenantId } });
    await prisma.subscriptionPayment.deleteMany({ where: { tenantId } });
    await prisma.payment.deleteMany({ where: { tenantId } });
    await prisma.productionJob.deleteMany({ where: { tenantId } });
    await prisma.orderItem.deleteMany({ where: { tenantId } });
    await prisma.order.deleteMany({ where: { tenantId } });
    await prisma.measurementVersion.deleteMany({ where: { measurement: { tenantId } } });
    await prisma.customerMeasurement.deleteMany({ where: { tenantId } });
    await prisma.garmentType.deleteMany({ where: { tenantId } });
    await prisma.customer.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.subscription.deleteMany({ where: { tenantId } });
    await prisma.branch.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    console.log('✔ Cleaned up test tenant.');

  } catch (err: any) {
    console.error('Unhandled test exception:', err);
    failed++;
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    console.log('\n================================================================');
    console.log(`TOTAL PASSED: ${passed}`);
    console.log(`TOTAL FAILED: ${failed}`);
    console.log('================================================================');
    if (failed > 0) {
      process.exit(1);
    }
  }
}

runCleanTenantLifecycleTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
