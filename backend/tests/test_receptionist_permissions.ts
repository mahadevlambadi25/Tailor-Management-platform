import { RoleType } from '@prisma/client';

async function runReceptionistPermissionTests() {
  console.log('====================================================');
  console.log('  TESTING RECEPTIONIST ROLE PERMISSIONS & SECURITY  ');
  console.log('====================================================\n');

  const BASE_URL = 'http://localhost:5000/api/v1';

  // 1. Authenticate as Receptionist
  console.log('[1/6] Authenticating as receptionist@royalbespoke.com...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantSlug: 'royal-bespoke',
      email: 'receptionist@royalbespoke.com',
      password: 'Password@123'
    })
  });

  const loginData: any = await loginRes.json();
  if (!loginData.success) {
    throw new Error('FAILED: Receptionist login failed: ' + JSON.stringify(loginData));
  }

  const token = loginData.data.token;
  const user = loginData.data.user;
  const perms: string[] = loginData.data.permissions || [];

  if (user.role !== RoleType.RECEPTIONIST) {
    throw new Error(`FAILED: Expected role RECEPTIONIST, got ${user.role}`);
  }
  console.log('  ✔ PASS: Receptionist authenticated successfully with role RECEPTIONIST.');

  // 2. Validate Granular Permissions Payload
  console.log('\n[2/6] Validating granular permissions payload...');
  if (!perms.includes('reports:view')) {
    throw new Error('FAILED: Receptionist permissions missing reports:view');
  }
  if (!perms.includes('customers:*') || !perms.includes('orders:create') || !perms.includes('payments:create')) {
    throw new Error('FAILED: Receptionist missing standard front-desk permissions');
  }
  if (perms.includes('*') || perms.includes('reports:*') || perms.includes('settings:*') || perms.includes('users:*')) {
    throw new Error('FAILED: Receptionist has excessive administrative permissions!');
  }
  console.log(`  ✔ PASS: Permissions correctly scoped (${perms.length} permissions, includes reports:view, excludes admin keys).`);

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // 3. Testing Dashboard Operational API
  console.log('\n[3/6] Testing Dashboard API (GET /reports/owner-dashboard & GET /orders)...');
  const dashRes = await fetch(`${BASE_URL}/reports/owner-dashboard`, { headers });
  if (dashRes.status !== 200) {
    const errData = await dashRes.json();
    throw new Error(`FAILED: Dashboard API returned status ${dashRes.status}: ${JSON.stringify(errData)}`);
  }
  const dashData: any = await dashRes.json();
  if (!dashData.success || typeof dashData.data.totalOrders !== 'number') {
    throw new Error('FAILED: Invalid dashboard data structure: ' + JSON.stringify(dashData));
  }
  console.log(`  ✔ PASS: Dashboard KPIs retrieved successfully (totalOrders: ${dashData.data.totalOrders}, todayOrders: ${dashData.data.todayOrdersCount}).`);

  const recentOrdersRes = await fetch(`${BASE_URL}/orders?limit=6`, { headers });
  if (recentOrdersRes.status !== 200) {
    throw new Error(`FAILED: Recent orders returned status ${recentOrdersRes.status}`);
  }
  const recentOrdersData: any = await recentOrdersRes.json();
  console.log(`  ✔ PASS: Recent orders queue retrieved successfully (${recentOrdersData.data?.orders?.length || 0} orders).`);

  // 4. Testing Front-Desk Allowed Operations (Customers, Walk-in Orders, Measurements, Appointments, Payments)
  console.log('\n[4/6] Testing Core Front-Desk Operations...');

  // Create Customer
  const timestamp = Date.now();
  const newCustRes = await fetch(`${BASE_URL}/customers`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      firstName: 'TestWalkin',
      lastName: `Client-${timestamp}`,
      mobile: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: `walkin.${timestamp}@example.com`
    })
  });
  const newCustData: any = await newCustRes.json();
  if (!newCustData.success) {
    throw new Error('FAILED: Receptionist failed to create customer: ' + JSON.stringify(newCustData));
  }
  const customerId = newCustData.data.id;
  console.log(`  ✔ PASS: Created walk-in customer (ID: ${customerId}).`);

  // Create Walk-in Order
  const garmentsRes = await fetch(`${BASE_URL}/garments`, { headers });
  const garmentsData: any = await garmentsRes.json();
  const garmentTypeId = garmentsData.data?.[0]?.id;

  const newOrderRes = await fetch(`${BASE_URL}/orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      customerId,
      deliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      priority: 'REGULAR',
      items: [
        {
          garmentTypeId,
          itemPrice: 3500,
          quantity: 1,
          measurementValues: { Chest: 38, Waist: 32 }
        }
      ],
      discountType: 'FIXED',
      discountValue: 0,
      advanceAmount: 1500,
      paymentMethod: 'CASH',
      paymentReference: `REC-CASH-${timestamp}`
    })
  });
  const newOrderData: any = await newOrderRes.json();
  if (!newOrderData.success) {
    throw new Error('FAILED: Receptionist failed to book walk-in order: ' + JSON.stringify(newOrderData));
  }
  const orderId = newOrderData.data.id;
  console.log(`  ✔ PASS: Booked walk-in order (Order #${newOrderData.data.orderNumber}).`);

  // Save Measurements
  const measureRes = await fetch(`${BASE_URL}/measurements`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      customerId,
      garmentTypeId,
      values: { Chest: 38, Waist: 32, Length: 29 },
      unit: 'INCHES'
    })
  });
  const measureData: any = await measureRes.json();
  if (!measureData.success) {
    throw new Error('FAILED: Receptionist failed to save measurements: ' + JSON.stringify(measureData));
  }
  console.log('  ✔ PASS: Recorded customer measurements.');

  // Book Appointment
  const apptRes = await fetch(`${BASE_URL}/appointments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      customerId,
      appointmentType: 'TRIAL',
      scheduledAt: new Date(Date.now() + 3 * 86400000).toISOString(),
      notes: 'First fitting trial for bespoke shirt'
    })
  });
  const apptData: any = await apptRes.json();
  if (!apptData.success) {
    throw new Error('FAILED: Receptionist failed to book appointment: ' + JSON.stringify(apptData));
  }
  console.log('  ✔ PASS: Scheduled trial appointment.');

  // Record Payment
  const payRes = await fetch(`${BASE_URL}/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      orderId,
      amount: 1000,
      paymentMethod: 'UPI',
      referenceNumber: `UPI-REC-${timestamp}`
    })
  });
  const payData: any = await payRes.json();
  if (!payData.success) {
    throw new Error('FAILED: Receptionist failed to record payment: ' + JSON.stringify(payData));
  }
  console.log('  ✔ PASS: Recorded payment receipt.');

  // 5. Strict Authorization Enforcement on Protected Endpoints (Expected 403 Forbidden)
  console.log('\n[5/6] Testing Strict Backend RBAC Defense (Unpermitted Operations)...');

  const forbiddenTests = [
    { name: 'GET /reports/analytics (Deep Analytics)', url: `${BASE_URL}/reports/analytics`, method: 'GET' },
    { name: 'POST /users (Create Staff Member)', url: `${BASE_URL}/users`, method: 'POST', body: JSON.stringify({ name: 'Hacker', email: 'hack@royalbespoke.com', role: 'SHOP_OWNER' }) },
    { name: 'POST /tenants/feature-flags (Tenant Settings)', url: `${BASE_URL}/tenants/feature-flags`, method: 'POST', body: JSON.stringify({ featureKey: 'DARK_MODE', isEnabled: true }) },
    { name: 'DELETE /customers/:id (Soft-Delete Customer)', url: `${BASE_URL}/customers/${customerId}`, method: 'DELETE' },
    { name: 'POST /production/jobs/:id/assign (Assign Workshop Staff)', url: `${BASE_URL}/production/jobs/dummy-job/assign`, method: 'POST', body: JSON.stringify({ staffId: user.id }) },
    { name: 'POST /production/jobs/:id/stage (Advance Production Stage)', url: `${BASE_URL}/production/jobs/dummy-job/stage`, method: 'POST', body: JSON.stringify({ stage: 'STITCHING' }) }
  ];

  for (const ft of forbiddenTests) {
    const res = await fetch(ft.url, { method: ft.method, headers, body: ft.body });
    if (res.status !== 403) {
      throw new Error(`SECURITY VULNERABILITY: ${ft.name} returned status ${res.status} instead of 403 Forbidden!`);
    }
    const errData: any = await res.json();
    if (errData.error?.code !== 'FORBIDDEN_ROLE') {
      throw new Error(`FAILED: Expected FORBIDDEN_ROLE error code for ${ft.name}, got ${errData.error?.code}`);
    }
    console.log(`  ✔ PASS: ${ft.name} correctly blocked with 403 Forbidden (${errData.error.message}).`);
  }

  // 6. Test Document Retrieval (Print View)
  console.log('\n[6/6] Testing Printable Shell & QR Data Access...');
  const printRes = await fetch(`${BASE_URL}/documents/orders/${orderId}/print`, { headers });
  if (printRes.status !== 200) {
    throw new Error(`FAILED: Document print data returned status ${printRes.status}`);
  }
  const printData: any = await printRes.json();
  if (!printData.success || !printData.data?.order) {
    throw new Error('FAILED: Print data contract invalid: ' + JSON.stringify(printData));
  }
  console.log('  ✔ PASS: Order print receipt and invoice data accessible.');

  console.log('\n====================================================');
  console.log('  ALL RECEPTIONIST ROLE PERMISSION TESTS PASSED!     ');
  console.log('====================================================');
}

runReceptionistPermissionTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
