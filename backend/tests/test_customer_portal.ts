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

async function runCustomerPortalTests() {
  console.log('================================================================');
  console.log('  CUSTOMER SELF-SERVICE PORTAL — VERIFICATION & INTEGRATION     ');
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
    // Setup: Retrieve Test Tenants and Test Customers
    // -------------------------------------------------------------
    const tenant1 = await prisma.tenant.findUnique({ where: { slug: 'royal-bespoke' } });
    if (!tenant1) throw new Error('Tenant 1 (royal-bespoke) not found.');

    const tenant2 = await prisma.tenant.findUnique({ where: { slug: 'elite-stitching' } });
    if (!tenant2) throw new Error('Tenant 2 (elite-stitching) not found.');

    const owner1 = await prisma.user.findFirst({
      where: { tenantId: tenant1.id, role: RoleType.SHOP_OWNER }
    });
    if (!owner1) throw new Error('Owner 1 not found.');

    const manager1 = await prisma.user.findFirst({
      where: { tenantId: tenant1.id, role: RoleType.MANAGER }
    });

    // Create Customer A in Tenant 1
    const customerA = await prisma.customer.upsert({
      where: { tenantId_customerId: { tenantId: tenant1.id, customerId: 'CUST-PORTAL-A' } },
      update: { isDeleted: false },
      create: {
        customerId: 'CUST-PORTAL-A',
        tenantId: tenant1.id,
        firstName: 'Aarav',
        lastName: 'Sharma',
        mobile: '9988776655',
        email: 'aarav.sharma@test.portal',
        address: '42 MG Road, Indiranagar',
        city: 'Bengaluru',
        notes: 'VIP customer. Prefers Italian fabric.'
      }
    });

    // Create Customer B in Tenant 1 (for cross-customer isolation testing)
    const customerB = await prisma.customer.upsert({
      where: { tenantId_customerId: { tenantId: tenant1.id, customerId: 'CUST-PORTAL-B' } },
      update: { isDeleted: false },
      create: {
        customerId: 'CUST-PORTAL-B',
        tenantId: tenant1.id,
        firstName: 'Bhavna',
        lastName: 'Patel',
        mobile: '9988776644',
        email: 'bhavna.patel@test.portal',
        address: '15 Brigade Road',
        city: 'Bengaluru',
        notes: 'Secret internal note for Bhavna.'
      }
    });

    // Create Customer C in Tenant 2 (for cross-tenant isolation testing)
    const customerC = await prisma.customer.upsert({
      where: { tenantId_customerId: { tenantId: tenant2.id, customerId: 'CUST-PORTAL-C' } },
      update: { isDeleted: false },
      create: {
        customerId: 'CUST-PORTAL-C',
        tenantId: tenant2.id,
        firstName: 'Chirag',
        lastName: 'Desai',
        mobile: '9988776633',
        email: 'chirag.desai@test.portal',
        address: '88 SG Highway',
        city: 'Ahmedabad'
      }
    });

    // Ensure a Garment Type for orders
    const garmentType = await prisma.garmentType.findFirst({
      where: { tenantId: tenant1.id }
    });
    if (!garmentType) throw new Error('Garment type not found in Tenant 1.');

    // Seed Order for Customer A (Active, with payment & snapshot)
    const orderA = await prisma.order.upsert({
      where: { tenantId_orderNumber: { tenantId: tenant1.id, orderNumber: 'ORD-PORTAL-A1' } },
      update: { customerId: customerA.id },
      create: {
        orderNumber: 'ORD-PORTAL-A1',
        tenantId: tenant1.id,
        customerId: customerA.id,
        status: OrderStatus.IN_PROGRESS,
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        totalAmount: 10000.0,
        discountAmount: 1000.0,
        netAmount: 9000.0,
        paidAmount: 5000.0,
        balanceAmount: 4000.0,
        paymentStatus: PaymentStatus.PARTIAL,
        customerNotes: 'Please ensure extra fabric in sleeve cuffs.',
        internalNotes: 'INTERNAL WORKSHOP SECRET: Do not rush cutter.',
        delayReason: 'INTERNAL DELAY: Lining fabric shipment arrived late.',
        items: {
          create: {
            tenantId: tenant1.id,
            garmentTypeId: garmentType.id,
            itemPrice: 10000.0,
            quantity: 1,
            totalItemPrice: 10000.0,
            status: ProductionStageName.CUTTING,
            customerNotes: 'Monogram "AS" on inner lapel.',
            measurementSnapshot: {
              create: {
                tenantId: tenant1.id,
                unit: 'INCHES',
                valuesSnapshot: { chest: 42, waist: 36, length: 30 }
              }
            }
          }
        },
        payments: {
          create: {
            tenantId: tenant1.id,
            customerId: customerA.id,
            amount: 5000.0,
            paymentMethod: PaymentMethod.UPI,
            isRefund: false,
            receipts: {
              create: {
                tenantId: tenant1.id,
                receiptNumber: 'REC-PORTAL-A1',
                amount: 5000.0
              }
            }
          }
        }
      }
    });

    // Seed Order for Customer B (Order for Customer B)
    const orderB = await prisma.order.upsert({
      where: { tenantId_orderNumber: { tenantId: tenant1.id, orderNumber: 'ORD-PORTAL-B1' } },
      update: { customerId: customerB.id },
      create: {
        orderNumber: 'ORD-PORTAL-B1',
        tenantId: tenant1.id,
        customerId: customerB.id,
        status: OrderStatus.READY_FOR_PICKUP,
        deliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        totalAmount: 6000.0,
        discountAmount: 0.0,
        netAmount: 6000.0,
        paidAmount: 6000.0,
        balanceAmount: 0.0,
        paymentStatus: PaymentStatus.PAID,
        customerNotes: 'Keep ready for evening reception.',
        internalNotes: 'Customer Bhavna requested priority.',
        items: {
          create: {
            tenantId: tenant1.id,
            garmentTypeId: garmentType.id,
            itemPrice: 6000.0,
            quantity: 1,
            totalItemPrice: 6000.0,
            status: ProductionStageName.READY
          }
        }
      }
    });

    // Seed Measurements for Customer A
    await prisma.customerMeasurement.upsert({
      where: { id: 'meas-portal-a1' },
      update: { customerId: customerA.id },
      create: {
        id: 'meas-portal-a1',
        tenantId: tenant1.id,
        customerId: customerA.id,
        garmentTypeId: garmentType.id,
        name: 'Standard Suit Profile',
        unit: 'INCHES',
        versions: {
          create: {
            versionNumber: 1,
            values: { chest: 42, waist: 36, shoulder: 18.5, sleeve: 25.0 }
          }
        }
      }
    });

    // Auth Tokens
    const tokenCustA = jwt.sign(
      {
        id: customerA.id,
        customerId: customerA.id,
        tenantId: tenant1.id,
        name: `${customerA.firstName} ${customerA.lastName}`,
        mobile: customerA.mobile,
        role: RoleType.CUSTOMER
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    const tokenCustB = jwt.sign(
      {
        id: customerB.id,
        customerId: customerB.id,
        tenantId: tenant1.id,
        name: `${customerB.firstName} ${customerB.lastName}`,
        mobile: customerB.mobile,
        role: RoleType.CUSTOMER
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    const tokenOwner1 = jwt.sign(
      { id: owner1.id, tenantId: tenant1.id, email: owner1.email, role: owner1.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const authCustA = { Authorization: `Bearer ${tokenCustA}`, 'x-tenant-id': tenant1.id };
    const authCustB = { Authorization: `Bearer ${tokenCustB}`, 'x-tenant-id': tenant1.id };
    const authOwner1 = { Authorization: `Bearer ${tokenOwner1}`, 'x-tenant-id': tenant1.id };

    // =============================================================
    // SECTION A: Authentication & Session Security (10 Tests)
    // =============================================================
    console.log('\n--- SUITE A: Customer OTP Authentication & Session Security ---');

    // 1. Request OTP with registered mobile
    const otpReq1 = await request(baseUrl, 'POST', '/auth/customer/request-otp', { 'x-tenant-id': tenant1.id }, {
      mobile: customerA.mobile
    });
    assert(otpReq1.status === 200, 'Request OTP with registered mobile returns 200 OK');
    assert(otpReq1.body.data.mobile === customerA.mobile, 'OTP response echoes customer mobile');

    // 2. Request OTP with non-existent mobile
    const otpReqNonExistent = await request(baseUrl, 'POST', '/auth/customer/request-otp', { 'x-tenant-id': tenant1.id }, {
      mobile: '9000000000'
    });
    assert(otpReqNonExistent.status === 404, 'Request OTP for unregistered mobile returns 404');
    assert(otpReqNonExistent.body.error.code === 'CUSTOMER_NOT_FOUND', 'Returns CUSTOMER_NOT_FOUND code');

    // 3. Request OTP with missing mobile
    const otpReqMissing = await request(baseUrl, 'POST', '/auth/customer/request-otp', { 'x-tenant-id': tenant1.id }, {});
    assert(otpReqMissing.status === 400, 'Request OTP with missing mobile returns 400');
    assert(otpReqMissing.body.error.code === 'MISSING_MOBILE', 'Returns MISSING_MOBILE code');

    // 4. Verify OTP with correct code ("123456" in dev/test)
    const otpVerifyCorrect = await request(baseUrl, 'POST', '/auth/customer/verify-otp', { 'x-tenant-id': tenant1.id }, {
      mobile: customerA.mobile,
      otp: '123456'
    });
    assert(otpVerifyCorrect.status === 200, 'Verify OTP with valid code returns 200 OK');
    assert(Boolean(otpVerifyCorrect.body.data.token), 'JWT token returned on OTP verification');
    assert(otpVerifyCorrect.body.data.customer.customerId === customerA.customerId, 'Correct customer identity in response');

    // 5. Request new OTP and verify with incorrect code
    await request(baseUrl, 'POST', '/auth/customer/request-otp', { 'x-tenant-id': tenant1.id }, { mobile: customerA.mobile });
    const otpVerifyIncorrect = await request(baseUrl, 'POST', '/auth/customer/verify-otp', { 'x-tenant-id': tenant1.id }, {
      mobile: customerA.mobile,
      otp: '999999'
    });
    assert(otpVerifyIncorrect.status === 400, 'Verify OTP with incorrect code returns 400');
    assert(otpVerifyIncorrect.body.error.code === 'OTP_INCORRECT', 'Returns OTP_INCORRECT code');

    // 6. Max verification attempts exceeded
    await request(baseUrl, 'POST', '/auth/customer/verify-otp', { 'x-tenant-id': tenant1.id }, { mobile: customerA.mobile, otp: '999998' });
    const otpMaxAttempts = await request(baseUrl, 'POST', '/auth/customer/verify-otp', { 'x-tenant-id': tenant1.id }, {
      mobile: customerA.mobile,
      otp: '999997'
    });
    assert(otpMaxAttempts.status === 429, 'Exceeding 3 failed OTP attempts triggers 429');
    assert(otpMaxAttempts.body.error.code === 'OTP_MAX_ATTEMPTS', 'Returns OTP_MAX_ATTEMPTS code');

    // 7. Expired OTP verification rejected
    const expiredOtp = await prisma.customerOtp.create({
      data: {
        tenantId: tenant1.id,
        mobile: customerA.mobile,
        otpHash: 'dummy',
        expiresAt: new Date(Date.now() - 60000)
      }
    });
    const otpExpiredRes = await request(baseUrl, 'POST', '/auth/customer/verify-otp', { 'x-tenant-id': tenant1.id }, {
      mobile: customerA.mobile,
      otp: '123456'
    });
    assert(otpExpiredRes.status === 400 || otpExpiredRes.status === 429, 'Expired OTP rejected');

    // 8. GET /auth/me returns customer identity and role permissions
    const meRes = await request(baseUrl, 'GET', '/auth/me', authCustA);
    assert(meRes.status === 200, 'GET /auth/me returns 200 OK for Customer session');
    assert(meRes.body.data.user.role === 'CUSTOMER', 'Session role is CUSTOMER');
    assert(Array.isArray(meRes.body.data.permissions), 'Permissions array returned');
    assert(meRes.body.data.permissions.includes('portal:view'), 'Customer permissions include portal:view');

    // 9. Missing or malformed Bearer token returns 401
    const unauthRes = await request(baseUrl, 'GET', '/portal/dashboard', { Authorization: 'Bearer bad_token' });
    assert(unauthRes.status === 401, 'Malformed token returns 401 UNAUTHORIZED');

    // 10. Verified token contains customerId and tenantId
    const decodedToken = jwt.verify(tokenCustA, config.jwtSecret) as any;
    assert(decodedToken.customerId === customerA.id, 'JWT contains valid customerId');
    assert(decodedToken.tenantId === tenant1.id, 'JWT contains valid tenantId');

    // =============================================================
    // SECTION B: Ownership & Tenant Isolation (12 Tests)
    // =============================================================
    console.log('\n--- SUITE B: Customer Ownership & Tenant Isolation ---');

    // 11. Customer A queries dashboard -> returns Customer A's metrics
    const dashA = await request(baseUrl, 'GET', '/portal/dashboard', authCustA);
    assert(dashA.status === 200, 'Customer A queries /portal/dashboard with 200 OK');
    assert(dashA.body.data.customer.customerId === customerA.customerId, 'Dashboard belongs strictly to Customer A');
    assert(dashA.body.data.kpis.activeOrdersCount >= 1, 'Active orders count reflects Customer A orders');

    // 12. Customer A queries orders list -> strictly Customer A orders returned
    const ordersA = await request(baseUrl, 'GET', '/portal/orders', authCustA);
    assert(ordersA.status === 200, 'Customer A queries /portal/orders with 200 OK');
    assert(Array.isArray(ordersA.body.data), 'Orders is an array');
    const hasOrderA = ordersA.body.data.some((o: any) => o.orderNumber === 'ORD-PORTAL-A1');
    const hasOrderB = ordersA.body.data.some((o: any) => o.orderNumber === 'ORD-PORTAL-B1');
    assert(hasOrderA, 'Orders list includes Customer A order (ORD-PORTAL-A1)');
    assert(!hasOrderB, 'Orders list STRICTLY EXCLUDES Customer B order (ORD-PORTAL-B1)');

    // 13. Customer A queries Customer B's order by ID -> 404 NOT FOUND (opaque, no leak)
    const crossOrderById = await request(baseUrl, 'GET', `/portal/orders/${orderB.id}`, authCustA);
    assert(crossOrderById.status === 404, 'Customer A querying Customer B order returns 404 NOT_FOUND');
    assert(crossOrderById.body.error.code === 'ORDER_NOT_FOUND', 'Returns ORDER_NOT_FOUND code');

    // 14. Customer A queries Customer B's order payments -> 404 NOT FOUND
    const crossPaymentsRes = await request(baseUrl, 'GET', `/portal/orders/${orderB.id}/payments`, authCustA);
    assert(crossPaymentsRes.status === 404, 'Customer A querying Customer B payments returns 404');

    // 15. Cross-tenant attempt: Customer A trying to use Tenant 2 header/endpoint
    const crossTenantRes = await request(baseUrl, 'GET', '/portal/dashboard', {
      Authorization: `Bearer ${tokenCustA}`,
      'x-tenant-id': tenant2.id
    });
    // In authGuard: req.tenantId is strictly forced from decoded.tenantId, so it remains Tenant 1
    assert(crossTenantRes.status === 200 && crossTenantRes.body.data.customer.customerId === customerA.customerId,
      'authGuard prevents tenant spoofing by enforcing token tenantId over request header'
    );

    // 16. Customer A queries measurements -> returns only Customer A fit profiles
    const measA = await request(baseUrl, 'GET', '/portal/measurements', authCustA);
    assert(measA.status === 200, 'Customer A queries /portal/measurements with 200 OK');
    assert(Array.isArray(measA.body.data.fitProfiles), 'fitProfiles is an array');

    // 17. Injected ?customerId= parameter in query is strictly IGNORED for Customer role
    const injectedQueryRes = await request(baseUrl, 'GET', `/portal/orders?customerId=${customerB.id}`, authCustA);
    assert(injectedQueryRes.status === 200, 'Injected ?customerId= returns 200');
    const stillHasOrderB = injectedQueryRes.body.data.some((o: any) => o.orderNumber === 'ORD-PORTAL-B1');
    assert(!stillHasOrderB, 'Injected ?customerId= is strictly ignored; Customer A still cannot see Customer B');

    // 18. Customer A queries own profile
    const profileA = await request(baseUrl, 'GET', '/portal/profile', authCustA);
    assert(profileA.status === 200, 'Customer A queries /portal/profile with 200 OK');
    assert(profileA.body.data.mobile === customerA.mobile, 'Profile reflects Customer A mobile');
    assert(profileA.body.data.customerId === customerA.customerId, 'Profile reflects Customer A ID');

    // 19. Customer attempts to tamper with tenantId in PUT /portal/profile -> Rejected
    const tamperTenantRes = await request(baseUrl, 'PUT', '/portal/profile', authCustA, {
      tenantId: tenant2.id,
      address: 'Hacked address'
    });
    assert(tamperTenantRes.status === 400, 'Attempt to tamper with tenantId returns 400 Bad Request');
    assert(tamperTenantRes.body.error.code === 'IMMUTABLE_IDENTIFIER', 'Returns IMMUTABLE_IDENTIFIER code');

    // 20. Customer attempts to modify registered mobile number -> Rejected
    const tamperMobileRes = await request(baseUrl, 'PUT', '/portal/profile', authCustA, {
      mobile: '9111111111'
    });
    assert(tamperMobileRes.status === 400, 'Attempt to tamper with mobile returns 400');
    assert(tamperMobileRes.body.error.code === 'IMMUTABLE_IDENTIFIER', 'Returns IMMUTABLE_IDENTIFIER code');

    // 21. Safe profile update: updating address and fit preference -> 200 OK
    const updateProfileRes = await request(baseUrl, 'PUT', '/portal/profile', authCustA, {
      address: '77 Residency Road, Penthouse 4',
      city: 'Bengaluru',
      preferences: {
        fitPreference: 'SLIM',
        preferredContactMethod: 'WHATSAPP'
      }
    });
    assert(updateProfileRes.status === 200, 'Safe profile update returns 200 OK');
    assert(updateProfileRes.body.data.address === '77 Residency Road, Penthouse 4', 'Updated address saved');

    // 22. Soft-deleted customer cannot access portal
    const softDeletedCust = await prisma.customer.upsert({
      where: {
        tenantId_customerId: {
          tenantId: tenant1.id,
          customerId: 'CUST-DELETED-1'
        }
      },
      update: { isDeleted: true },
      create: {
        customerId: 'CUST-DELETED-1',
        tenantId: tenant1.id,
        firstName: 'Inactive',
        lastName: 'User',
        mobile: '9123456780',
        isDeleted: true
      }
    });
    const delCustToken = jwt.sign(
      { id: softDeletedCust.id, customerId: softDeletedCust.id, tenantId: tenant1.id, role: 'CUSTOMER' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    const delAccessRes = await request(baseUrl, 'GET', '/portal/dashboard', {
      Authorization: `Bearer ${delCustToken}`,
      'x-tenant-id': tenant1.id
    });
    assert(delAccessRes.status === 404, 'Soft-deleted customer receives 404 CUSTOMER_NOT_FOUND');

    // =============================================================
    // SECTION C: Data Sanitization & Internal Info Protection (8 Tests)
    // =============================================================
    console.log('\n--- SUITE C: Data Sanitization & Information Protection ---');

    // 23. Orders list strictly omits internalNotes
    ordersA.body.data.forEach((o: any) => {
      assert(o.internalNotes === undefined, `Order ${o.orderNumber}: internalNotes is strictly stripped`);
    });

    // 24. Orders list strictly omits delayReason
    ordersA.body.data.forEach((o: any) => {
      assert(o.delayReason === undefined, `Order ${o.orderNumber}: delayReason is strictly stripped`);
    });

    // 25. Orders list strictly omits assignedToId and craftsman IDs
    ordersA.body.data.forEach((o: any) => {
      assert(o.assignedToId === undefined, `Order ${o.orderNumber}: assignedToId is strictly stripped`);
      assert(o.cutterId === undefined, `Order ${o.orderNumber}: cutterId is strictly stripped`);
      assert(o.tailorId === undefined, `Order ${o.orderNumber}: tailorId is strictly stripped`);
    });

    // 26. Single Order detail exposes only customer-safe notes
    const singleOrderRes = await request(baseUrl, 'GET', `/portal/orders/${orderA.id}`, authCustA);
    assert(singleOrderRes.status === 200, 'GET /portal/orders/:id returns 200 OK');
    const orderData = singleOrderRes.body.data;
    assert(orderData.customerNotes === 'Please ensure extra fabric in sleeve cuffs.', 'customerNotes is visible to client');
    assert(orderData.internalNotes === undefined, 'internalNotes is strictly omitted from order detail');
    assert(orderData.delayReason === undefined, 'delayReason is strictly omitted from order detail');

    // 27. Measurement snapshot values are exposed cleanly without drafting formulas
    const itemWithSnapshot = orderData.items.find((i: any) => i.measurementSnapshot);
    assert(itemWithSnapshot !== undefined, 'OrderItem has measurementSnapshot');
    assert(itemWithSnapshot.measurementSnapshot.values.chest === 42, 'Snapshot chest measurement is accurate');

    // 28. Payment records display clean receipts without cashier internal audit trails
    assert(Array.isArray(orderData.billing.payments), 'billing.payments is an array');
    const pay1 = orderData.billing.payments[0];
    assert(pay1.amount === 5000, 'Payment amount matches');
    assert(pay1.receiptNumber === 'REC-PORTAL-A1', 'Receipt number is visible to client');
    assert(pay1.recordedById === undefined, 'Cashier staff ID is omitted');
    assert(pay1.isCorrection === undefined, 'Internal accounting flag is omitted');

    // 29. Dashboard does not leak storewide commercial sales or analytics
    assert(dashA.body.data.kpis.totalStoreRevenue === undefined, 'Dashboard omits storewide revenue');
    assert(dashA.body.data.kpis.allCustomersCount === undefined, 'Dashboard omits total customer count');

    // 30. Audit log entries are completely inaccessible to customer
    const auditRes = await request(baseUrl, 'GET', '/audit-logs', authCustA);
    assert(auditRes.status === 404 || auditRes.status === 403, 'Customer cannot access audit logs');

    // =============================================================
    // SECTION D: Role-Based Access Control (RBAC) Gating (10 Tests)
    // =============================================================
    console.log('\n--- SUITE D: Role-Based Access Control (RBAC) Gating ---');

    // 31. Customer blocked from business reports
    assert((await request(baseUrl, 'GET', '/reports/overview', authCustA)).status === 403, 'CUSTOMER -> 403 on /reports/overview');

    // 32. Customer blocked from staff order management list
    assert((await request(baseUrl, 'GET', '/orders', authCustA)).status === 403, 'CUSTOMER -> 403 on staff /orders');

    // 33. Customer blocked from creating staff orders
    assert((await request(baseUrl, 'POST', '/orders', authCustA, { totalAmount: 100 })).status === 403, 'CUSTOMER -> 403 on POST /orders');

    // 34. Customer blocked from staff payments list
    assert((await request(baseUrl, 'GET', '/payments', authCustA)).status === 403, 'CUSTOMER -> 403 on staff /payments');

    // 35. Customer blocked from recording payments
    assert((await request(baseUrl, 'POST', '/payments', authCustA, { amount: 500 })).status === 403, 'CUSTOMER -> 403 on POST /payments');

    // 36. Customer blocked from workshop production board
    assert((await request(baseUrl, 'GET', '/production/board', authCustA)).status === 403, 'CUSTOMER -> 403 on /production/board');

    // 37. Customer blocked from shop customer directory
    assert((await request(baseUrl, 'GET', '/customers', authCustA)).status === 403, 'CUSTOMER -> 403 on /customers directory');

    // 38. Customer blocked from staff management
    assert((await request(baseUrl, 'GET', '/staff', authCustA)).status === 403, 'CUSTOMER -> 403 on /staff');

    // 39. Shop Owner can preview customer portal when explicitly passing customerId
    const ownerPreviewRes = await request(baseUrl, 'GET', `/portal/dashboard?customerId=${customerA.id}`, authOwner1);
    assert(ownerPreviewRes.status === 200, 'SHOP_OWNER -> 200 on /portal/dashboard with ?customerId= (preview allowed)');
    assert(ownerPreviewRes.body.data.customer.customerId === customerA.customerId, 'Owner preview displays target customer data');

    // 40. Shop Owner without customerId query gets 400 CUSTOMER_ID_REQUIRED_FOR_STAFF_PREVIEW
    const ownerNoIdRes = await request(baseUrl, 'GET', '/portal/dashboard', authOwner1);
    assert(ownerNoIdRes.status === 400, 'SHOP_OWNER without ?customerId= receives 400 (unsafe fallback eliminated)');
    assert(ownerNoIdRes.body.error.code === 'CUSTOMER_ID_REQUIRED_FOR_STAFF_PREVIEW', 'Returns expected error code');

    // =============================================================
    // SECTION E: Billing Math & Zero Online Payments (6 Tests)
    // =============================================================
    console.log('\n--- SUITE E: Financial Math & Manual Ledger Ledger Rules ---');

    // 41. Formula verification on Order A: Gross - Discount = Net
    const billA = orderData.billing;
    assert(billA.grossAmount - billA.discountAmount === billA.netAmount, 'Billing math: Gross - Discount = Net Amount');

    // 42. Balance Due verification: Net - Paid = Balance Due
    assert(billA.netAmount - billA.paidAmount === billA.balanceAmount, 'Billing math: Net - Paid = Balance Due');
    assert(billA.balanceAmount === 4000, 'Balance due is exactly ₹4,000');

    // 43. Zero online checkout / gateway endpoints
    const checkoutAttempt = await request(baseUrl, 'POST', '/portal/checkout', authCustA, { amount: 1000 });
    assert(checkoutAttempt.status === 404, 'No customer online checkout endpoint exists (404 Not Found)');

    // 44. Billing notice informs client about in-store payment only
    assert(billA.storeNotice.includes('in-store via Cash, UPI, or Card'), 'Billing notice clarifies in-store manual payment only');

    // 45. Customer B with zero balance shows status PAID
    const orderBDetail = await request(baseUrl, 'GET', `/portal/orders/${orderB.id}`, authCustB);
    assert(orderBDetail.status === 200, 'Customer B order detail returns 200 OK');
    assert(orderBDetail.body.data.billing.balanceAmount === 0, 'Customer B balance is ₹0');
    assert(orderBDetail.body.data.billing.paymentStatus === 'PAID', 'Customer B payment status is PAID');

    // 46. Order A with partial balance shows status PARTIAL
    assert(billA.paymentStatus === 'PARTIAL', 'Order A payment status is PARTIAL');

  } catch (err: any) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    server.close();
    console.log('\n================================================================');
    console.log(`  CUSTOMER PORTAL RESULTS: ${passed} PASSED / ${failed} FAILED`);
    console.log('================================================================\n');
    if (failed > 0) {
      process.exit(1);
    }
  }
}

runCustomerPortalTests().catch((err) => {
  console.error('Unhandled failure:', err);
  process.exit(1);
});
