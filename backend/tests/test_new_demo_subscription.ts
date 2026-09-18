import { prisma } from '../src/core/prisma';

async function runDemoSubscriptionLifecycleVerification() {
  const BASE_URL = 'http://localhost:5000/api/v1';

  console.log('--- STARTING COMPREHENSIVE DEMO & PAYMENT-SAFE SUBSCRIPTION VERIFICATION ---\n');

  // 1. Authenticate as Royal Bespoke Owner
  console.log('[STEP 1] Authenticating as shop owner...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantSlug: 'royal-bespoke',
      email: 'owner@royalbespoke.com',
      password: 'Password@123'
    })
  });
  const loginData: any = await loginRes.json();
  if (!loginData.success) {
    throw new Error('Authentication failed: ' + JSON.stringify(loginData));
  }
  const token = loginData.data.token;
  const tenantId = loginData.data.user.tenant.id;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-tenant-slug': 'royal-bespoke'
  };
  console.log(`  ✔ Authenticated. Tenant ID: ${tenantId}`);

  // Clear any existing demo data first to establish known baseline
  await fetch(`${BASE_URL}/tenants/demo-data/clear`, { method: 'POST', headers });
  await prisma.customer.deleteMany({ where: { tenantId, mobile: '9876543999' } });

  // 2. Create REAL Customer (isDemo: false)
  console.log('\n[STEP 2] Creating REAL customer (isDemo: false)...');
  const realCustRes = await fetch(`${BASE_URL}/customers`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      firstName: 'Rahul',
      lastName: 'Verma',
      mobile: '9876543999',
      email: 'rahul.verma@gmail.com',
      city: 'Bangalore',
      address: 'Indiranagar 12th Main'
    })
  });
  const realCustData: any = await realCustRes.json();
  if (!realCustData.success) {
    throw new Error('Failed to create real customer: ' + JSON.stringify(realCustData));
  }
  const realCustomerId = realCustData.data.id;
  console.log(`  ✔ Real customer created: ${realCustData.data.firstName} ${realCustData.data.lastName} (ID: ${realCustomerId})`);

  // Verify in DB that isDemo is false for real customer
  const dbRealCust = await prisma.customer.findUnique({ where: { id: realCustomerId } });
  if (dbRealCust?.isDemo !== false) {
    throw new Error(`Real customer should have isDemo === false, but got ${dbRealCust?.isDemo}`);
  }
  console.log('  ✔ Verified in DB: real customer has isDemo === false');

  // 3. Load Demo Data (isDemo: true)
  console.log('\n[STEP 3] Loading Demo Data via POST /tenants/demo-data/load...');
  const loadRes = await fetch(`${BASE_URL}/tenants/demo-data/load`, { method: 'POST', headers });
  const loadData: any = await loadRes.json();
  if (!loadData.success) {
    throw new Error('Failed to load demo data: ' + JSON.stringify(loadData));
  }
  console.log(`  ✔ ${loadData.message}`);

  // Inspect database records for isDemo flag
  const demoCusts = await prisma.customer.findMany({ where: { tenantId, isDemo: true } });
  const demoOrders = await prisma.order.findMany({ where: { tenantId, isDemo: true } });
  const demoAppts = await prisma.appointment.findMany({ where: { tenantId, isDemo: true } });

  console.log(`  ✔ Verified in DB: found ${demoCusts.length} demo customers, ${demoOrders.length} demo orders, ${demoAppts.length} demo appointments with isDemo: true.`);
  if (demoCusts.length === 0 || demoOrders.length === 0 || demoAppts.length === 0) {
    throw new Error('Demo records were not tagged with isDemo: true properly!');
  }

  // Check GET /tenants demoStats
  const tenantRes = await fetch(`${BASE_URL}/tenants`, { headers });
  const tenantData: any = await tenantRes.json();
  console.log('  ✔ API demoStats:', tenantData.data.demoStats);
  if (!tenantData.data.demoStats.hasDemoData) {
    throw new Error('demoStats.hasDemoData should be true!');
  }

  // 4. Test Checkout: status PENDING -> demo data must NOT be deleted!
  console.log('\n[STEP 4] Testing Subscription Checkout (status: PENDING)...');
  const checkoutRes = await fetch(`${BASE_URL}/tenants/subscription/checkout`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ planName: 'PRO_ENTERPRISE' })
  });
  const checkoutData: any = await checkoutRes.json();
  if (!checkoutData.success || checkoutData.data.status !== 'PENDING') {
    throw new Error('Checkout did not return PENDING: ' + JSON.stringify(checkoutData));
  }
  console.log('  ✔ Checkout initiated with status PENDING.');

  const countAfterCheckout = await prisma.order.count({ where: { tenantId, isDemo: true } });
  console.log(`  ✔ Demo orders count after checkout: ${countAfterCheckout}`);
  if (countAfterCheckout === 0) {
    throw new Error('CRITICAL FAILURE: Demo data was deleted during checkout! It must be retained until payment is confirmed.');
  }

  // 5. Test Cancel: status CANCELLED -> demo data must NOT be deleted!
  console.log('\n[STEP 5] Testing Subscription Cancellation (status: CANCELLED)...');
  const cancelRes = await fetch(`${BASE_URL}/tenants/subscription/cancel`, { method: 'POST', headers });
  const cancelData: any = await cancelRes.json();
  if (!cancelData.success || cancelData.data.status !== 'CANCELLED') {
    throw new Error('Cancel failed: ' + JSON.stringify(cancelData));
  }
  console.log('  ✔ Subscription cancelled.');

  const countAfterCancel = await prisma.order.count({ where: { tenantId, isDemo: true } });
  console.log(`  ✔ Demo orders count after cancel: ${countAfterCancel}`);
  if (countAfterCancel === 0) {
    throw new Error('CRITICAL FAILURE: Demo data was deleted during cancel!');
  }

  // 6. Test Fail: status FAILED -> demo data must NOT be deleted!
  console.log('\n[STEP 6] Testing Subscription Payment Failure (status: FAILED)...');
  const failRes = await fetch(`${BASE_URL}/tenants/subscription/fail`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason: 'Card declined by issuing bank' })
  });
  const failData: any = await failRes.json();
  if (!failData.success || failData.data.status !== 'FAILED') {
    throw new Error('Fail endpoint failed: ' + JSON.stringify(failData));
  }
  console.log('  ✔ Payment failed recorded.');

  const countAfterFail = await prisma.order.count({ where: { tenantId, isDemo: true } });
  console.log(`  ✔ Demo orders count after payment failure: ${countAfterFail}`);
  if (countAfterFail === 0) {
    throw new Error('CRITICAL FAILURE: Demo data was deleted on failed payment!');
  }

  // 7. Multi-Tenant Isolation Setup: create another tenant with demo data
  console.log('\n[STEP 7] Setting up second tenant to test tenant-isolation of demo cleanup...');
  let tenantB = await prisma.tenant.findUnique({ where: { slug: 'test-isolation-tenant-b' } });
  if (!tenantB) {
    tenantB = await prisma.tenant.create({
      data: {
        name: 'Tenant B Haute Couture',
        slug: 'test-isolation-tenant-b',
        phone: '9112233445'
      }
    });
  }
  // Clean up any prior tenantB customers
  await prisma.customer.deleteMany({ where: { tenantId: tenantB.id } });
  const custB = await prisma.customer.create({
    data: {
      tenantId: tenantB.id,
      customerId: 'CUST-DEMO-TENANT-B',
      firstName: 'TenantB',
      lastName: 'Customer',
      mobile: '9000000002',
      isDemo: true
    }
  });
  console.log(`  ✔ Tenant B created with demo customer ID: ${custB.id}`);

  // 8. Test Confirm: status ACTIVE -> ONLY NOW is demo data deleted!
  console.log('\n[STEP 8] Testing Subscription Confirm & Activation (status: ACTIVE)...');
  const confirmRes = await fetch(`${BASE_URL}/tenants/subscription/confirm`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      planName: 'PRO_ENTERPRISE_ACTIVE',
      paymentId: 'PAY_MOCK_SUCCESS_12345'
    })
  });
  const confirmData: any = await confirmRes.json();
  if (!confirmData.success || confirmData.data.subscription.status !== 'ACTIVE') {
    throw new Error('Confirm failed: ' + JSON.stringify(confirmData));
  }
  console.log(`  ✔ Subscription confirmed ACTIVE. Purge result:`, confirmData.data.purgeResult);

  // Verify Royal Bespoke demo data is GONE
  const demoOrdersLeft = await prisma.order.count({ where: { tenantId, isDemo: true } });
  const demoCustsLeft = await prisma.customer.count({ where: { tenantId, isDemo: true } });
  const demoApptsLeft = await prisma.appointment.count({ where: { tenantId, isDemo: true } });
  console.log(`  ✔ Royal Bespoke demo records remaining: ${demoOrdersLeft} orders, ${demoCustsLeft} customers, ${demoApptsLeft} appointments`);
  if (demoOrdersLeft !== 0 || demoCustsLeft !== 0 || demoApptsLeft !== 0) {
    throw new Error('Demo records were not purged upon confirmed subscription!');
  }

  // 9. Verify REAL Customer Rahul Verma is 100% PRESERVED!
  console.log('\n[STEP 9] Verifying REAL customer data preservation...');
  const preservedRealCust = await prisma.customer.findUnique({ where: { id: realCustomerId } });
  if (!preservedRealCust) {
    throw new Error('CRITICAL FAILURE: Real customer was deleted by mistake during demo purge!');
  }
  console.log(`  ✔ Real customer ${preservedRealCust.firstName} ${preservedRealCust.lastName} is 100% intact!`);

  // 10. Verify Tenant B demo data is 100% PRESERVED!
  console.log('\n[STEP 10] Verifying multi-tenant isolation (Tenant B data)...');
  const preservedCustB = await prisma.customer.findUnique({ where: { id: custB.id } });
  if (!preservedCustB) {
    throw new Error('CRITICAL FAILURE: Tenant B demo customer was deleted by Tenant A purge!');
  }
  console.log('  ✔ Tenant B demo customer is 100% intact (multi-tenant isolation confirmed)!');

  // 11. Idempotency test: calling confirm / clear again causes no errors and no data loss
  console.log('\n[STEP 11] Testing Idempotency (calling clear / confirm a second time)...');
  const idempotencyRes = await fetch(`${BASE_URL}/tenants/subscription/confirm`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      planName: 'PRO_ENTERPRISE_ACTIVE',
      paymentId: 'PAY_MOCK_SUCCESS_IDEMPOTENT'
    })
  });
  const idempotencyData: any = await idempotencyRes.json();
  if (!idempotencyData.success) {
    throw new Error('Idempotent confirm call failed: ' + JSON.stringify(idempotencyData));
  }
  console.log('  ✔ Second confirm call ran cleanly with deleted count:', idempotencyData.data.purgeResult);

  const realCustAfterSecondCall = await prisma.customer.findUnique({ where: { id: realCustomerId } });
  if (!realCustAfterSecondCall) {
    throw new Error('Real customer lost on idempotent call!');
  }
  console.log('  ✔ Real customer still 100% intact after second execution.');

  // Clean up test data
  await prisma.customer.deleteMany({ where: { id: realCustomerId } });
  await prisma.customer.deleteMany({ where: { tenantId: tenantB.id } });
  await prisma.tenant.delete({ where: { id: tenantB.id } });

  console.log('\n===============================================================');
  console.log('✔ ALL NEW DEMO & PAYMENT-SAFE SUBSCRIPTION TESTS PASSED 100%!');
  console.log('===============================================================\n');
}

runDemoSubscriptionLifecycleVerification().catch((err) => {
  console.error('Lifecycle test failed:', err);
  process.exit(1);
});
