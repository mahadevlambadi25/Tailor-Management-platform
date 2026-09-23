import http from 'http';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { config } from '../src/config';
import { prisma } from '../src/core/prisma';
import { OrderStatus, ProductionStageName, PaymentStatus, PaymentMethod, RoleType } from '@prisma/client';

async function request(
  baseUrl: string,
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${baseUrl}${path}`);
    const req = http.request(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          let parsed: any = null;
          try {
            parsed = JSON.parse(rawData);
          } catch {
            parsed = rawData;
          }
          resolve({ status: res.statusCode || 500, body: parsed, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runReportsTests() {
  console.log('================================================================');
  console.log('  REPORTS & OPERATIONAL ANALYTICS — VERIFICATION & INTEGRATION  ');
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

  // Start ephemeral test server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

  try {
    // -------------------------------------------------------------
    // Setup: Retrieve Test Tenants and Users
    // -------------------------------------------------------------
    const tenant1 = await prisma.tenant.findUnique({ where: { slug: 'royal-bespoke' } });
    if (!tenant1) throw new Error('Tenant 1 (royal-bespoke) not found.');

    const tenant2 = await prisma.tenant.findUnique({ where: { slug: 'elite-stitching' } });
    if (!tenant2) throw new Error('Tenant 2 (elite-stitching) not found.');

    const owner1 = await prisma.user.findFirst({
      where: { tenantId: tenant1.id, role: RoleType.SHOP_OWNER }
    });
    if (!owner1) throw new Error('Owner 1 not found.');

    const manager1 = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant1.id, email: 'manager_rep_test@royal.test' } },
      update: { role: RoleType.MANAGER, isActive: true },
      create: {
        tenantId: tenant1.id,
        name: 'Manager Divya',
        email: 'manager_rep_test@royal.test',
        passwordHash: 'dummy_hash',
        role: RoleType.MANAGER,
        isActive: true
      }
    });

    const cashier1 = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant1.id, email: 'cashier_rep_test@royal.test' } },
      update: { role: RoleType.CASHIER, isActive: true },
      create: {
        tenantId: tenant1.id,
        name: 'Cashier Vikram',
        email: 'cashier_rep_test@royal.test',
        passwordHash: 'dummy_hash',
        role: RoleType.CASHIER,
        isActive: true
      }
    });

    const receptionist1 = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant1.id, email: 'reception_rep_test@royal.test' } },
      update: { role: RoleType.RECEPTIONIST, isActive: true },
      create: {
        tenantId: tenant1.id,
        name: 'Receptionist Sneha',
        email: 'reception_rep_test@royal.test',
        passwordHash: 'dummy_hash',
        role: RoleType.RECEPTIONIST,
        isActive: true
      }
    });

    const tailor1 = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant1.id, email: 'tailor_rep_test@royal.test' } },
      update: { role: RoleType.TAILOR, isActive: true },
      create: {
        tenantId: tenant1.id,
        name: 'Tailor Karim',
        email: 'tailor_rep_test@royal.test',
        passwordHash: 'dummy_hash',
        role: RoleType.TAILOR,
        isActive: true
      }
    });

    const customerUser1 = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant1.id, email: 'customer_rep_test@royal.test' } },
      update: { role: RoleType.CUSTOMER, isActive: true },
      create: {
        tenantId: tenant1.id,
        name: 'Customer Client',
        email: 'customer_rep_test@royal.test',
        passwordHash: 'dummy_hash',
        role: RoleType.CUSTOMER,
        isActive: true
      }
    });

    // Tenant 2 Owner
    const owner2 = await prisma.user.findFirst({
      where: { tenantId: tenant2.id, role: RoleType.SHOP_OWNER }
    });
    if (!owner2) throw new Error('Owner 2 not found.');

    // Ensure a Branch in Tenant 1 and a Branch in Tenant 2
    const branch1 = await prisma.branch.upsert({
      where: { tenantId_name: { tenantId: tenant1.id, name: 'Bespoke Central Branch' } },
      update: { isMain: true },
      create: {
        tenantId: tenant1.id,
        name: 'Bespoke Central Branch',
        code: 'BCB',
        isMain: true
      }
    });

    const branch2 = await prisma.branch.upsert({
      where: { tenantId_name: { tenantId: tenant2.id, name: 'Elite North Branch' } },
      update: { isMain: true },
      create: {
        tenantId: tenant2.id,
        name: 'Elite North Branch',
        code: 'ENB',
        isMain: true
      }
    });

    // Tokens
    const owner1Token = jwt.sign(
      { id: owner1.id, tenantId: tenant1.id, email: owner1.email, role: owner1.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    const manager1Token = jwt.sign(
      { id: manager1.id, tenantId: tenant1.id, email: manager1.email, role: manager1.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    const cashier1Token = jwt.sign(
      { id: cashier1.id, tenantId: tenant1.id, email: cashier1.email, role: cashier1.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    const receptionist1Token = jwt.sign(
      { id: receptionist1.id, tenantId: tenant1.id, email: receptionist1.email, role: receptionist1.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    const tailor1Token = jwt.sign(
      { id: tailor1.id, tenantId: tenant1.id, email: tailor1.email, role: tailor1.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    const customerToken = jwt.sign(
      { id: customerUser1.id, tenantId: tenant1.id, email: customerUser1.email, role: customerUser1.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    const owner2Token = jwt.sign(
      { id: owner2.id, tenantId: tenant2.id, email: owner2.email, role: owner2.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const authOwner1 = { Authorization: `Bearer ${owner1Token}`, 'x-tenant-id': tenant1.id };
    const authManager1 = { Authorization: `Bearer ${manager1Token}`, 'x-tenant-id': tenant1.id };
    const authCashier1 = { Authorization: `Bearer ${cashier1Token}`, 'x-tenant-id': tenant1.id };
    const authReceptionist1 = { Authorization: `Bearer ${receptionist1Token}`, 'x-tenant-id': tenant1.id };
    const authTailor1 = { Authorization: `Bearer ${tailor1Token}`, 'x-tenant-id': tenant1.id };
    const authCustomer = { Authorization: `Bearer ${customerToken}`, 'x-tenant-id': tenant1.id };
    const authOwner2 = { Authorization: `Bearer ${owner2Token}`, 'x-tenant-id': tenant2.id };

    // =============================================================
    // 1. DATE PRESET & VALIDATION TESTS
    // =============================================================
    console.log('\n--- SUITE 1: Date Presets & Bounds Validation ---');

    for (const p of ['TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'LAST_MONTH']) {
      const res = await request(baseUrl, 'GET', `/reports/overview?range=${p}`, authOwner1);
      assert(res.status === 200, `Preset ${p} returns 200 OK`, JSON.stringify(res.body));
      assert(res.body.data.period.preset === p, `Preset ${p} echo in response`);
    }

    // Invalid preset
    const invalidPresetRes = await request(baseUrl, 'GET', `/reports/overview?range=DECADE`, authOwner1);
    assert(invalidPresetRes.status === 400, 'Invalid preset returns 400 Bad Request');
    assert(invalidPresetRes.body.error.code === 'INVALID_DATE_PRESET', 'Error code is INVALID_DATE_PRESET');

    // Custom date missing dates
    const missingCustomRes = await request(baseUrl, 'GET', `/reports/overview?range=CUSTOM`, authOwner1);
    assert(missingCustomRes.status === 400, 'CUSTOM missing dates returns 400');
    assert(missingCustomRes.body.error.code === 'MISSING_CUSTOM_DATES', 'Error code is MISSING_CUSTOM_DATES');

    // Custom invalid date format
    const invalidFormatRes = await request(baseUrl, 'GET', `/reports/overview?range=CUSTOM&startDate=invalid&endDate=2026-05-01`, authOwner1);
    assert(invalidFormatRes.status === 400, 'Invalid format returns 400');
    assert(invalidFormatRes.body.error.code === 'INVALID_DATE_FORMAT', 'Error code is INVALID_DATE_FORMAT');

    // Custom startDate > endDate
    const invalidSeqRes = await request(baseUrl, 'GET', `/reports/overview?range=CUSTOM&startDate=2026-05-01&endDate=2026-01-01`, authOwner1);
    assert(invalidSeqRes.status === 400, 'startDate > endDate returns 400');
    assert(invalidSeqRes.body.error.code === 'INVALID_DATE_SEQUENCE', 'Error code is INVALID_DATE_SEQUENCE');

    // Custom window > 366 days
    const windowExceededRes = await request(baseUrl, 'GET', `/reports/overview?range=CUSTOM&startDate=2024-01-01&endDate=2026-01-01`, authOwner1);
    assert(windowExceededRes.status === 400, 'Range > 1 year returns 400');
    assert(windowExceededRes.body.error.code === 'DATE_WINDOW_EXCEEDED', 'Error code is DATE_WINDOW_EXCEEDED');

    // Valid Custom range
    const validCustomRes = await request(baseUrl, 'GET', `/reports/overview?range=CUSTOM&startDate=2026-01-01&endDate=2026-01-31`, authOwner1);
    assert(validCustomRes.status === 200, 'Valid custom range returns 200 OK');
    assert(validCustomRes.body.data.period.preset === 'CUSTOM', 'Preset is CUSTOM');

    // =============================================================
    // 2. OVERVIEW REPORT & 12 KPIS
    // =============================================================
    console.log('\n--- SUITE 2: Overview Report & 12 Dashboard KPIs ---');

    const overviewRes = await request(baseUrl, 'GET', '/reports/overview?range=THIS_MONTH', authOwner1);
    assert(overviewRes.status === 200, 'Overview report returns 200');
    const kpis = overviewRes.body.data.kpis;
    assert(typeof kpis.totalCustomers === 'number', 'kpi.totalCustomers is a valid number');
    assert(typeof kpis.newCustomers === 'number', 'kpi.newCustomers is a valid number');
    assert(typeof kpis.totalOrders === 'number', 'kpi.totalOrders is a valid number');
    assert(typeof kpis.newOrders === 'number', 'kpi.newOrders is a valid number');
    assert(typeof kpis.ordersInProgress === 'number', 'kpi.ordersInProgress is a valid number');
    assert(typeof kpis.ordersReadyForPickup === 'number', 'kpi.ordersReadyForPickup is a valid number');
    assert(typeof kpis.deliveredOrders === 'number', 'kpi.deliveredOrders is a valid number');
    assert(typeof kpis.delayedOrders === 'number', 'kpi.delayedOrders is a valid number');
    assert(typeof kpis.pendingPaymentOrders === 'number', 'kpi.pendingPaymentOrders is a valid number');
    assert(typeof kpis.todayCollection === 'number', 'kpi.todayCollection is a valid number');
    assert(typeof kpis.periodCollection === 'number', 'kpi.periodCollection is a valid number');
    assert(typeof kpis.totalRevenue === 'number', 'kpi.totalRevenue is a valid number');
    assert(typeof kpis.outstandingReceivables === 'number', 'kpi.outstandingReceivables is a valid number');
    assert(!isNaN(kpis.todayCollection) && !isNaN(kpis.outstandingReceivables), 'Zero NaN values in overview KPIs');

    // =============================================================
    // 3. ORDER REPORTS
    // =============================================================
    console.log('\n--- SUITE 3: Order Reports & Analytics ---');

    const ordersRes = await request(baseUrl, 'GET', '/reports/orders?range=THIS_MONTH', authOwner1);
    assert(ordersRes.status === 200, 'Orders report returns 200');
    const orderData = ordersRes.body.data;

    // Status breakdown must cover all 7 statuses
    assert(Array.isArray(orderData.ordersByStatus), 'ordersByStatus is an array');
    const returnedStatuses = orderData.ordersByStatus.map((s: any) => s.status);
    const expectedStatuses = ['RECEIVED', 'IN_PROGRESS', 'TRIAL_PENDING', 'ALTERATION_PENDING', 'READY_FOR_PICKUP', 'DELIVERED', 'CANCELLED'];
    const allStatusesPresent = expectedStatuses.every(s => returnedStatuses.includes(s));
    assert(allStatusesPresent, 'All 7 OrderStatus enum values present in ordersByStatus');

    // Garment breakdown
    assert(Array.isArray(orderData.ordersByGarment), 'ordersByGarment is an array');

    // Summary calculations
    const oSummary = orderData.summary;
    assert(typeof oSummary.totalOrders === 'number', 'summary.totalOrders is a number');
    assert(typeof oSummary.averageOrderValue === 'number', 'summary.averageOrderValue is a number');
    assert(typeof oSummary.cancellationRate === 'number', 'summary.cancellationRate is a number');
    assert(typeof oSummary.onTimeDeliveryRate === 'number', 'summary.onTimeDeliveryRate is a number');
    assert(Array.isArray(orderData.dailyTimeline), 'dailyTimeline is an array');

    // =============================================================
    // 4. PAYMENT REPORTS
    // =============================================================
    console.log('\n--- SUITE 4: Payment Reports (Manual Ledger Only) ---');

    const paymentsRes = await request(baseUrl, 'GET', '/reports/payments?range=THIS_MONTH', authOwner1);
    assert(paymentsRes.status === 200, 'Payments report returns 200');
    const pData = paymentsRes.body.data;

    // Collections summary
    assert(typeof pData.summary.grossCollections === 'number', 'summary.grossCollections is a number');
    assert(typeof pData.summary.refunds === 'number', 'summary.refunds is a number');
    assert(typeof pData.summary.netCollections === 'number', 'summary.netCollections is a number');
    assert(pData.summary.netCollections >= 0, 'summary.netCollections is non-negative');

    // Collections by method covers CASH, UPI, CARD, BANK_TRANSFER, OTHER
    assert(Array.isArray(pData.collectionsByMethod), 'collectionsByMethod is an array');
    const methods = pData.collectionsByMethod.map((m: any) => m.method);
    const expectedMethods = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER'];
    const allMethodsPresent = expectedMethods.every(m => methods.includes(m));
    assert(allMethodsPresent, 'All 5 PaymentMethod enums present in collectionsByMethod');

    // Payment status breakdown
    assert(pData.paymentStatusBreakdown.fullyPaid !== undefined, 'fullyPaid section exists');
    assert(pData.paymentStatusBreakdown.partiallyPaid !== undefined, 'partiallyPaid section exists');
    assert(pData.paymentStatusBreakdown.unpaid !== undefined, 'unpaid section exists');
    assert(Array.isArray(pData.dailyTimeline), 'payments dailyTimeline is an array');

    // =============================================================
    // 5. PRODUCTION REPORTS
    // =============================================================
    console.log('\n--- SUITE 5: Production Reports & Workshop Stages ---');

    const prodRes = await request(baseUrl, 'GET', '/reports/production?range=THIS_MONTH', authOwner1);
    assert(prodRes.status === 200, 'Production report returns 200');
    const prodData = prodRes.body.data;

    // Stage counts must cover all 8 stages
    assert(Array.isArray(prodData.stageCounts), 'stageCounts is an array');
    const returnedStages = prodData.stageCounts.map((sc: any) => sc.stage);
    const expectedStages = ['RECEIVED', 'CUTTING', 'STITCHING', 'FINISHING', 'TRIAL', 'ALTERATION', 'READY', 'DELIVERED'];
    const allStagesPresent = expectedStages.every(s => returnedStages.includes(s));
    assert(allStagesPresent, 'All 8 ProductionStageName values present in stageCounts');

    // Delayed jobs
    assert(typeof prodData.delayedJobs.total === 'number', 'delayedJobs.total is a number');
    assert(Array.isArray(prodData.delayedJobs.jobs), 'delayedJobs.jobs is an array');
    assert(Array.isArray(prodData.delayedJobs.reasons), 'delayedJobs.reasons is an array');

    // Craft workload
    assert(prodData.craftWorkload.byRole.CUTTER !== undefined, 'craftWorkload has CUTTER');
    assert(prodData.craftWorkload.byRole.TAILOR !== undefined, 'craftWorkload has TAILOR');
    assert(prodData.craftWorkload.byRole.FINISHER !== undefined, 'craftWorkload has FINISHER');
    assert(Array.isArray(prodData.craftWorkload.staff), 'craftWorkload.staff is an array');

    // =============================================================
    // 6. CUSTOMER REPORTS
    // =============================================================
    console.log('\n--- SUITE 6: Customer Growth & Receivables Reports ---');

    const custRes = await request(baseUrl, 'GET', '/reports/customers?range=THIS_MONTH', authOwner1);
    assert(custRes.status === 200, 'Customers report returns 200');
    const custData = custRes.body.data;

    assert(typeof custData.summary.totalCustomers === 'number', 'custData.totalCustomers is a number');
    assert(typeof custData.summary.newCustomers === 'number', 'custData.newCustomers is a number');
    assert(typeof custData.summary.repeatCustomerRate === 'number', 'custData.repeatCustomerRate is a number');
    assert(Array.isArray(custData.topCustomers), 'topCustomers is an array');
    if (custData.topCustomers.length > 0) {
      const top1 = custData.topCustomers[0];
      assert(top1.customerId !== undefined, 'topCustomers item has customerId');
      assert(top1.totalSpend !== undefined, 'topCustomers item has totalSpend');
      assert(top1.balanceDue !== undefined, 'topCustomers item has balanceDue');
      assert(top1.password === undefined, 'No sensitive password leak in customer report');
    }

    // =============================================================
    // 7. STAFF OPERATIONAL REPORTS (ZERO SUBJECTIVE RATINGS)
    // =============================================================
    console.log('\n--- SUITE 7: Staff Reports (Factual Operational Counts Only) ---');

    const staffRes = await request(baseUrl, 'GET', '/reports/staff?range=THIS_MONTH', authOwner1);
    assert(staffRes.status === 200, 'Staff report returns 200');
    const staffData = staffRes.body.data;

    assert(Array.isArray(staffData.staff), 'staffData.staff is an array');
    staffData.staff.forEach((s: any) => {
      assert(typeof s.assignedJobs === 'number', `Staff ${s.name} assignedJobs is a number`);
      assert(typeof s.completedJobs === 'number', `Staff ${s.name} completedJobs is a number`);
      assert(typeof s.delayedJobs === 'number', `Staff ${s.name} delayedJobs is a number`);
      assert(s.rating === undefined, `Strict rule: Staff ${s.name} has no subjective rating`);
      assert(s.score === undefined, `Strict rule: Staff ${s.name} has no performance score`);
      assert(s.rank === undefined, `Strict rule: Staff ${s.name} has no rank`);
    });

    // =============================================================
    // 8. MULTI-TENANT ISOLATION & SECURITY
    // =============================================================
    console.log('\n--- SUITE 8: Multi-Tenant Isolation ---');

    const t1Overview = await request(baseUrl, 'GET', '/reports/overview?range=THIS_MONTH', authOwner1);
    const t2Overview = await request(baseUrl, 'GET', '/reports/overview?range=THIS_MONTH', authOwner2);

    assert(t1Overview.status === 200, 'Tenant 1 overview returns 200');
    assert(t2Overview.status === 200, 'Tenant 2 overview returns 200');

    // Branch scoping and isolation
    const validBranchRes = await request(baseUrl, 'GET', `/reports/overview?branchId=${branch1.id}`, authOwner1);
    assert(validBranchRes.status === 200, 'Tenant 1 query with own branch returns 200');

    // Tenant 1 querying with Tenant 2's branch -> 404 BRANCH_NOT_FOUND
    const crossBranchRes = await request(baseUrl, 'GET', `/reports/overview?branchId=${branch2.id}`, authOwner1);
    assert(crossBranchRes.status === 404, 'Cross-tenant branch access rejected with 404');
    assert(crossBranchRes.body.error.code === 'BRANCH_NOT_FOUND', 'Error code is BRANCH_NOT_FOUND');

    // Non-existent branch UUID -> 404
    const nonExistentBranchRes = await request(baseUrl, 'GET', `/reports/overview?branchId=00000000-0000-0000-0000-000000000000`, authOwner1);
    assert(nonExistentBranchRes.status === 404, 'Non-existent branch returns 404');

    // =============================================================
    // 9. ROLE-BASED ACCESS CONTROL (RBAC) GATING
    // =============================================================
    console.log('\n--- SUITE 9: Role-Based Access Control (RBAC) ---');

    // SHOP_OWNER -> Full access (all 6 endpoints)
    assert((await request(baseUrl, 'GET', '/reports/overview', authOwner1)).status === 200, 'SHOP_OWNER -> 200 /overview');
    assert((await request(baseUrl, 'GET', '/reports/orders', authOwner1)).status === 200, 'SHOP_OWNER -> 200 /orders');
    assert((await request(baseUrl, 'GET', '/reports/payments', authOwner1)).status === 200, 'SHOP_OWNER -> 200 /payments');
    assert((await request(baseUrl, 'GET', '/reports/production', authOwner1)).status === 200, 'SHOP_OWNER -> 200 /production');
    assert((await request(baseUrl, 'GET', '/reports/customers', authOwner1)).status === 200, 'SHOP_OWNER -> 200 /customers');
    assert((await request(baseUrl, 'GET', '/reports/staff', authOwner1)).status === 200, 'SHOP_OWNER -> 200 /staff');

    // MANAGER -> Full access
    assert((await request(baseUrl, 'GET', '/reports/overview', authManager1)).status === 200, 'MANAGER -> 200 /overview');
    assert((await request(baseUrl, 'GET', '/reports/orders', authManager1)).status === 200, 'MANAGER -> 200 /orders');
    assert((await request(baseUrl, 'GET', '/reports/payments', authManager1)).status === 200, 'MANAGER -> 200 /payments');
    assert((await request(baseUrl, 'GET', '/reports/production', authManager1)).status === 200, 'MANAGER -> 200 /production');
    assert((await request(baseUrl, 'GET', '/reports/customers', authManager1)).status === 200, 'MANAGER -> 200 /customers');
    assert((await request(baseUrl, 'GET', '/reports/staff', authManager1)).status === 200, 'MANAGER -> 200 /staff');

    // CASHIER -> Collections & Overview only, 403 on others
    assert((await request(baseUrl, 'GET', '/reports/overview', authCashier1)).status === 200, 'CASHIER -> 200 /overview');
    assert((await request(baseUrl, 'GET', '/reports/payments', authCashier1)).status === 200, 'CASHIER -> 200 /payments');
    assert((await request(baseUrl, 'GET', '/reports/orders', authCashier1)).status === 403, 'CASHIER -> 403 /orders');
    assert((await request(baseUrl, 'GET', '/reports/production', authCashier1)).status === 403, 'CASHIER -> 403 /production');
    assert((await request(baseUrl, 'GET', '/reports/customers', authCashier1)).status === 403, 'CASHIER -> 403 /customers');
    assert((await request(baseUrl, 'GET', '/reports/staff', authCashier1)).status === 403, 'CASHIER -> 403 /staff');

    // RECEPTIONIST -> Overview, Orders, Customers only, 403 on Payments & Staff
    assert((await request(baseUrl, 'GET', '/reports/overview', authReceptionist1)).status === 200, 'RECEPTIONIST -> 200 /overview');
    assert((await request(baseUrl, 'GET', '/reports/orders', authReceptionist1)).status === 200, 'RECEPTIONIST -> 200 /orders');
    assert((await request(baseUrl, 'GET', '/reports/customers', authReceptionist1)).status === 200, 'RECEPTIONIST -> 200 /customers');
    assert((await request(baseUrl, 'GET', '/reports/payments', authReceptionist1)).status === 403, 'RECEPTIONIST -> 403 /payments');
    assert((await request(baseUrl, 'GET', '/reports/staff', authReceptionist1)).status === 403, 'RECEPTIONIST -> 403 /staff');

    // TAILOR -> Production only, 403 on Overview, Orders, Payments, Customers, Staff
    assert((await request(baseUrl, 'GET', '/reports/production', authTailor1)).status === 200, 'TAILOR -> 200 /production');
    assert((await request(baseUrl, 'GET', '/reports/overview', authTailor1)).status === 403, 'TAILOR -> 403 /overview');
    assert((await request(baseUrl, 'GET', '/reports/orders', authTailor1)).status === 403, 'TAILOR -> 403 /orders');
    assert((await request(baseUrl, 'GET', '/reports/payments', authTailor1)).status === 403, 'TAILOR -> 403 /payments');
    assert((await request(baseUrl, 'GET', '/reports/customers', authTailor1)).status === 403, 'TAILOR -> 403 /customers');
    assert((await request(baseUrl, 'GET', '/reports/staff', authTailor1)).status === 403, 'TAILOR -> 403 /staff');

    // CUSTOMER -> 403 on ALL internal reports
    assert((await request(baseUrl, 'GET', '/reports/overview', authCustomer)).status === 403, 'CUSTOMER -> 403 /overview');
    assert((await request(baseUrl, 'GET', '/reports/orders', authCustomer)).status === 403, 'CUSTOMER -> 403 /orders');
    assert((await request(baseUrl, 'GET', '/reports/payments', authCustomer)).status === 403, 'CUSTOMER -> 403 /payments');
    assert((await request(baseUrl, 'GET', '/reports/production', authCustomer)).status === 403, 'CUSTOMER -> 403 /production');
    assert((await request(baseUrl, 'GET', '/reports/customers', authCustomer)).status === 403, 'CUSTOMER -> 403 /customers');
    assert((await request(baseUrl, 'GET', '/reports/staff', authCustomer)).status === 403, 'CUSTOMER -> 403 /staff');

    // =============================================================
    // 10. EMPTY DATE RANGES & ZERO VALUES PROTECTION
    // =============================================================
    console.log('\n--- SUITE 10: Empty Date Ranges & Zero Protection ---');

    // Far future range where no orders/payments exist
    const futureRes = await request(
      baseUrl,
      'GET',
      '/reports/orders?range=CUSTOM&startDate=2038-01-01&endDate=2038-01-15',
      authOwner1
    );
    assert(futureRes.status === 200, 'Far future range returns 200 without crashing');
    const futureSummary = futureRes.body.data.summary;
    assert(futureSummary.totalOrders === 0, 'future totalOrders is 0');
    assert(futureSummary.averageOrderValue === 0, 'future averageOrderValue is safe 0 (no NaN/Infinity)');
    assert(futureSummary.cancellationRate === 0, 'future cancellationRate is safe 0');
    assert(futureSummary.onTimeDeliveryRate === 100, 'future onTimeDeliveryRate is 100 default');

    // =============================================================
    // 11. CSV EXPORT INTEGRATION & SCOPING
    // =============================================================
    console.log('\n--- SUITE 11: CSV Export Filtering & RFC 4180 Escaping ---');

    const csvOrdersRes = await request(
      baseUrl,
      'GET',
      '/import-export/export/ORDERS?range=THIS_MONTH',
      authOwner1
    );
    assert(csvOrdersRes.status === 200, 'Orders CSV export returns 200');
    assert(String(csvOrdersRes.headers['content-type']).includes('text/csv'), 'Orders CSV has text/csv Content-Type');
    assert(String(csvOrdersRes.body).includes('OrderNumber,Customer'), 'Orders CSV header includes OrderNumber');

    const csvPaymentsRes = await request(
      baseUrl,
      'GET',
      '/import-export/export/PAYMENTS?range=THIS_MONTH',
      authOwner1
    );
    assert(csvPaymentsRes.status === 200, 'Payments CSV export returns 200');
    assert(String(csvPaymentsRes.headers['content-type']).includes('text/csv'), 'Payments CSV has text/csv Content-Type');
    assert(String(csvPaymentsRes.body).includes('PaymentID,OrderNumber'), 'Payments CSV header includes PaymentID');

    const csvCustomersRes = await request(
      baseUrl,
      'GET',
      '/import-export/export/CUSTOMERS?range=THIS_MONTH',
      authOwner1
    );
    assert(csvCustomersRes.status === 200, 'Customers CSV export returns 200');
    assert(String(csvCustomersRes.body).includes('CustomerID,FirstName'), 'Customers CSV header includes CustomerID');

    const csvProductionRes = await request(
      baseUrl,
      'GET',
      '/import-export/export/PRODUCTION?range=THIS_MONTH',
      authOwner1
    );
    assert(csvProductionRes.status === 200, 'Production CSV export returns 200');
    assert(String(csvProductionRes.body).includes('JobID,OrderNumber'), 'Production CSV header includes JobID');

  } catch (err: any) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    server.close();
    console.log('\n================================================================');
    console.log(`  REPORTS MODULE RESULTS: ${passed} PASSED / ${failed} FAILED`);
    console.log('================================================================\n');
    if (failed > 0) {
      process.exit(1);
    }
  }
}

runReportsTests().catch((err) => {
  console.error('Unhandled failure:', err);
  process.exit(1);
});
