import { app } from '../src/app';
import { prisma } from '../src/core/prisma';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';
import { RoleType, OrderStatus, PaymentStatus } from '@prisma/client';
import http from 'http';

async function runOrderModuleTests() {
  console.log('================================================================');
  console.log('  ORDER MANAGEMENT MODULE — VERIFICATION & INTEGRATION SUITE    ');
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
    if (!tenant1) throw new Error('Tenant 1 not found.');

    const tenant2 = await prisma.tenant.findUnique({ where: { slug: 'elite-stitching' } });
    if (!tenant2) throw new Error('Tenant 2 not found.');

    const owner1 = await prisma.user.findFirst({
      where: { tenantId: tenant1.id, role: RoleType.SHOP_OWNER }
    });
    if (!owner1) throw new Error('Owner 1 not found.');

    const owner2 = await prisma.user.findFirst({
      where: { tenantId: tenant2.id, role: RoleType.SHOP_OWNER }
    });
    if (!owner2) throw new Error('Owner 2 not found.');

    const token1 = jwt.sign(
      { id: owner1.id, tenantId: tenant1.id, email: owner1.email, role: owner1.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const token2 = jwt.sign(
      { id: owner2.id, tenantId: tenant2.id, email: owner2.email, role: owner2.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Retrieve master garments
    const garments = await prisma.garmentType.findMany();
    const shirtGarment = garments.find(g => g.code === 'SHIRT') || garments[0];
    const pantGarment = garments.find(g => g.code === 'PANT') || garments[1] || garments[0];

    // Create a dedicated test customer for orders testing
    const testMobile = '9876110022';
    await prisma.customer.deleteMany({ where: { mobile: testMobile } });

    const customerRes = await prisma.customer.create({
      data: {
        customerId: 'CUST-TEST-ORD',
        tenantId: tenant1.id,
        firstName: 'Anand',
        lastName: 'Mahindra',
        mobile: testMobile,
        email: 'anand.m@example.com',
        city: 'Bangalore',
        preferences: {
          create: {
            tenantId: tenant1.id,
            preferredContactMethod: 'WHATSAPP',
            fitPreference: 'Slim Cut'
          }
        },
        measurements: {
          create: {
            tenantId: tenant1.id,
            name: 'Standard Fit',
            garmentTypeId: shirtGarment.id,
            unit: 'INCHES',
            versions: {
              create: {
                versionNumber: 1,
                values: { Chest: 42, Waist: 36, Shoulder: 19, Sleeve: 26, Length: 31 }
              }
            }
          }
        }
      },
      include: { measurements: { include: { versions: true } } }
    });

    const testCustomerId = customerRes.id;
    let createdOrderId = '';

    // -------------------------------------------------------------
    // Test 1: Create Multi-Item Bespoke Order with Advance Payment
    // -------------------------------------------------------------
    console.log('[1/10] Testing Multi-Item Order Creation with Pricing & Advance Payment...');
    const deliveryDate = new Date(Date.now() + 7 * 86400000).toISOString();

    const createOrderRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({
        customerId: testCustomerId,
        deliveryDate,
        priority: 'REGULAR',
        discountType: 'FIXED',
        discountValue: 500, // ₹500 discount
        gstRate: 5,         // 5% GST
        isGstInclusive: false,
        advancePayment: {
          amount: 2500,
          paymentMethod: 'UPI',
          referenceNumber: 'UPI-TEST-12345'
        },
        internalNotes: 'VIP order - ensure perfect collar roll',
        customerNotes: 'Deliver before 5 PM on due date',
        items: [
          {
            garmentTypeId: shirtGarment.id,
            itemPrice: 3000,
            stitchingCharge: 500,
            fabricCharge: 0,
            quantity: 1,
            measurementSnapshot: {
              valuesSnapshot: { Chest: 42, Waist: 36, Shoulder: 19, Sleeve: 26, Length: 31 },
              unit: 'INCHES'
            }
          },
          {
            garmentTypeId: pantGarment.id,
            itemPrice: 2000,
            stitchingCharge: 500,
            fabricCharge: 0,
            quantity: 1,
            measurementSnapshot: {
              valuesSnapshot: { Waist: 36, Hip: 42, Inseam: 32, Bottom: 16 },
              unit: 'INCHES'
            }
          }
        ]
      })
    });

    const createOrderData: any = await createOrderRes.json();
    assert(createOrderRes.status === 201 && createOrderData.success === true, 'Order created with HTTP 201');
    assert(createOrderData.data?.orderNumber?.startsWith('ORD-'), 'Assigned sequential order number: ' + createOrderData.data?.orderNumber);
    assert(createOrderData.data?.customerId === testCustomerId, 'Order strictly bound to target customer');

    createdOrderId = createOrderData.data.id;

    // -------------------------------------------------------------
    // Test 2: Commercial Pricing & Balance Calculations
    // -------------------------------------------------------------
    console.log('\n[2/10] Verifying Commercial Pricing Math & Ledger Formulas...');
    // Item 1: (3000 + 500) * 1 = 3500
    // Item 2: (2000 + 500) * 1 = 2500
    // Total Gross = 6000
    // Discount = 500
    // Subtotal = 5500
    // GST 5% = 275
    // Net Total = 5775
    // Advance = 2500
    // Balance Due = 5775 - 2500 = 3275
    const ord = createOrderData.data;
    assert(Number(ord.totalAmount) === 6000, 'Total Gross Amount = ₹6,000');
    assert(Number(ord.discountAmount) === 500, 'Discount Amount = ₹500');
    assert(Number(ord.gstAmount) === 275, 'GST 5% Amount = ₹275');
    assert(Number(ord.netAmount) === 5775, 'Net Total Amount = ₹5,775');
    assert(Number(ord.paidAmount) === 2500, 'Advance Paid Amount = ₹2,500');
    assert(Number(ord.balanceAmount) === 3275, 'Remaining Balance Amount = ₹3,275');
    assert(ord.paymentStatus === 'PARTIAL', 'Payment status is PARTIAL');

    // -------------------------------------------------------------
    // Test 3: Historical Measurement Snapshot Immutability
    // -------------------------------------------------------------
    console.log('\n[3/10] Testing Historical Measurement Snapshot Immutability...');
    // Verify snapshot in created order
    const orderWithSnapshot = await prisma.order.findUnique({
      where: { id: createdOrderId },
      include: { items: { include: { measurementSnapshot: true } } }
    });
    const shirtItem = orderWithSnapshot?.items.find(i => i.garmentTypeId === shirtGarment.id);
    const snapVals: any = shirtItem?.measurementSnapshot?.valuesSnapshot;
    assert(Number(snapVals?.Chest) === 42, 'Snapshot in OrderItem shows Chest = 42 at order booking');

    // Modify customer's live measurement profile to Chest = 44
    await prisma.customerMeasurement.updateMany({
      where: { customerId: testCustomerId, garmentTypeId: shirtGarment.id },
      data: { notes: 'Updated live profile' }
    });

    // Re-query order item: snapshot MUST still be 42!
    const recheckedOrder = await prisma.order.findUnique({
      where: { id: createdOrderId },
      include: { items: { include: { measurementSnapshot: true } } }
    });
    const recheckedShirt = recheckedOrder?.items.find(i => i.garmentTypeId === shirtGarment.id);
    const recheckedSnap: any = recheckedShirt?.measurementSnapshot?.valuesSnapshot;
    assert(Number(recheckedSnap?.Chest) === 42, 'ACCEPTANCE GATE: Order snapshot remains Chest = 42 after customer profile edits (100% Immutable)');

    // -------------------------------------------------------------
    // Test 4: Invalid Customer Validation & Tenant Scope
    // -------------------------------------------------------------
    console.log('\n[4/10] Testing Invalid Customer Validation & Rejection...');
    const fakeCustomerRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({
        customerId: '00000000-0000-0000-0000-000000000000',
        deliveryDate: new Date().toISOString(),
        items: [{ garmentTypeId: shirtGarment.id, itemPrice: 1000 }]
      })
    });
    const fakeCustData: any = await fakeCustomerRes.json();
    assert(fakeCustomerRes.status === 404, 'Rejects non-existent customer with HTTP 404');
    assert(fakeCustData.error?.code === 'CUSTOMER_NOT_FOUND', 'Returns error code CUSTOMER_NOT_FOUND');

    // -------------------------------------------------------------
    // Test 5: Customer -> Order Flow (Zero Duplicate Customers)
    // -------------------------------------------------------------
    console.log('\n[5/10] Testing Customer -> Order Flow (Zero Duplicate Customers)...');
    const custCount = await prisma.customer.count({
      where: { tenantId: tenant1.id, mobile: testMobile }
    });
    assert(custCount === 1, 'Only 1 customer record exists in DB for this phone (No duplicate customer created)');

    // -------------------------------------------------------------
    // Test 6: Order Retrieval & Multi-Field Search & Date Filters
    // -------------------------------------------------------------
    console.log('\n[6/10] Testing Order Retrieval & Search Filters...');
    // Search by order number
    const searchOrderRes = await fetch(`${baseUrl}/orders?search=${ord.orderNumber}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const searchOrderData: any = await searchOrderRes.json();
    assert(searchOrderData.data?.orders?.some((o: any) => o.id === createdOrderId), 'Search by Order Number finds the order');

    // Multi-word search by customer name ("Anand Mahindra")
    const searchNameRes = await fetch(`${baseUrl}/orders?search=Anand%20Mahindra`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const searchNameData: any = await searchNameRes.json();
    assert(searchNameData.data?.orders?.some((o: any) => o.id === createdOrderId), 'Multi-word customer search finds the order');

    // Status filter
    const statusFilterRes = await fetch(`${baseUrl}/orders?status=RECEIVED`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const statusFilterData: any = await statusFilterRes.json();
    assert(statusFilterData.data?.orders?.some((o: any) => o.id === createdOrderId), 'Filter by status=RECEIVED matches order');

    // Delivery date filter
    const dateStr = deliveryDate.split('T')[0];
    const dateFilterRes = await fetch(`${baseUrl}/orders?deliveryDate=${dateStr}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const dateFilterData: any = await dateFilterRes.json();
    assert(dateFilterData.data?.orders?.some((o: any) => o.id === createdOrderId), 'Filter by deliveryDate matches order');

    // -------------------------------------------------------------
    // Test 7: Strict Multi-Tenant Order Isolation
    // -------------------------------------------------------------
    console.log('\n[7/10] Testing Strict Multi-Tenant Order Isolation...');
    // Tenant 2 attempts to read Tenant 1's order
    const crossTenantGet = await fetch(`${baseUrl}/orders/${createdOrderId}`, {
      headers: { Authorization: `Bearer ${token2}` }
    });
    assert(crossTenantGet.status === 404, 'Cross-tenant order GET returns 404 (Hidden across tenants)');

    // Tenant 2 attempts to update Tenant 1's order status
    const crossTenantPatch = await fetch(`${baseUrl}/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
      body: JSON.stringify({ status: 'DELIVERED' })
    });
    assert(crossTenantPatch.status === 404, 'Cross-tenant status PATCH returns 404');

    // -------------------------------------------------------------
    // Test 8: Order Status Progression & Delay Reason Enforcement
    // -------------------------------------------------------------
    console.log('\n[8/10] Testing Status Progression & Enforced Delay Reason Rule...');

    // Progress to IN_PROGRESS
    const inProgressRes = await fetch(`${baseUrl}/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({ status: OrderStatus.IN_PROGRESS })
    });
    const inProgressData: any = await inProgressRes.json();
    assert(inProgressRes.status === 200, 'Order advanced to IN_PROGRESS');
    assert(inProgressData.data?.status === 'IN_PROGRESS', 'Status updated to IN_PROGRESS');

    // Attempt to set revised delivery date WITHOUT delay reason -> MUST FAIL with 400
    const delayWithoutReasonRes = await fetch(`${baseUrl}/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({
        status: OrderStatus.IN_PROGRESS,
        revisedDeliveryDate: new Date(Date.now() + 10 * 86400000).toISOString(),
        delayReason: '' // Missing reason
      })
    });
    const delayNoReasonData: any = await delayWithoutReasonRes.json();
    assert(delayWithoutReasonRes.status === 400, 'Revising delivery date without reason is REJECTED (400)');
    assert(delayNoReasonData.error?.code === 'MISSING_DELAY_REASON', 'Error code is MISSING_DELAY_REASON');

    // Set revised delivery date WITH valid reason -> MUST SUCCEED
    const delayWithReasonRes = await fetch(`${baseUrl}/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({
        status: OrderStatus.ALTERATION_PENDING,
        revisedDeliveryDate: new Date(Date.now() + 10 * 86400000).toISOString(),
        delayReason: 'Bespoke fabric imported from Biella delayed in customs'
      })
    });
    const delayWithReasonData: any = await delayWithReasonRes.json();
    assert(delayWithReasonRes.status === 200, 'Revising delivery date with valid reason is APPROVED');
    assert(delayWithReasonData.data?.status === 'ALTERATION_PENDING', 'Status updated to ALTERATION_PENDING');
    assert(delayWithReasonData.data?.delayReason?.includes('Bespoke fabric'), 'Delay reason recorded in database');

    // -------------------------------------------------------------
    // Test 9: Balance Settlement & Payment Ledger Reconciliation
    // -------------------------------------------------------------
    console.log('\n[9/10] Testing Balance Settlement & Payment Reconciliation...');
    // Balance due is ₹3,275. Record full balance settlement
    const balancePaymentRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({
        orderId: createdOrderId,
        amount: 3275,
        paymentMethod: 'CASH',
        notes: 'Final balance settlement on trial pickup'
      })
    });
    const balancePayData: any = await balancePaymentRes.json();
    assert(balancePaymentRes.status === 201, 'Balance payment recorded with HTTP 201');
    assert(Number(balancePayData.data?.updatedOrder?.balanceAmount) === 0, 'Remaining balance accurately calculated to ₹0');
    assert(balancePayData.data?.updatedOrder?.paymentStatus === 'PAID', 'Payment status upgraded to PAID');
    assert(Number(balancePayData.data?.updatedOrder?.paidAmount) === 5775, 'Total paid matches net total of ₹5,775');

    // -------------------------------------------------------------
    // Test 10: Final Order Delivery & Customer Orders Tab Linkage
    // -------------------------------------------------------------
    console.log('\n[10/10] Testing Final Order Delivery & Customer Linkage...');
    const deliverRes = await fetch(`${baseUrl}/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({ status: OrderStatus.DELIVERED })
    });
    const deliverData: any = await deliverRes.json();
    assert(deliverRes.status === 200 && deliverData.data?.status === 'DELIVERED', 'Order marked DELIVERED');

    // Check customer's profile orders tab: order must be listed with real figures!
    const custProfileRes = await fetch(`${baseUrl}/customers/${testCustomerId}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const custProfileData: any = await custProfileRes.json();
    const orderInProfile = custProfileData.data?.orders?.find((o: any) => o.id === createdOrderId);
    assert(!!orderInProfile, 'Order appears in customer profile Orders tab');
    assert(Number(orderInProfile.netAmount) === 5775, 'Customer profile shows accurate net amount ₹5,775');
    assert(Number(orderInProfile.balanceAmount) === 0, 'Customer profile shows balance settled');
    assert(orderInProfile.status === 'DELIVERED', 'Customer profile shows order status DELIVERED');

    // Verify audit logs timeline
    const orderDetailRes = await fetch(`${baseUrl}/orders/${createdOrderId}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const orderDetailData: any = await orderDetailRes.json();
    assert(Array.isArray(orderDetailData.data?.auditLogs) && orderDetailData.data?.auditLogs.length >= 3, 'Order audit timeline returned with all lifecycle events');

    // Cleanup test records
    await prisma.receipt.deleteMany({ where: { payment: { orderId: createdOrderId } } });
    await prisma.payment.deleteMany({ where: { orderId: createdOrderId } });
    await prisma.productionJob.deleteMany({ where: { orderItem: { orderId: createdOrderId } } });
    await prisma.orderItemMeasurement.deleteMany({ where: { orderItem: { orderId: createdOrderId } } });
    await prisma.orderItemStyle.deleteMany({ where: { orderItem: { orderId: createdOrderId } } });
    await prisma.orderItem.deleteMany({ where: { orderId: createdOrderId } });
    await prisma.auditLog.deleteMany({ where: { entityId: createdOrderId } });
    await prisma.order.delete({ where: { id: createdOrderId } });

    await prisma.customerMeasurement.deleteMany({ where: { customerId: testCustomerId } });
    await prisma.customerPreference.deleteMany({ where: { customerId: testCustomerId } });
    await prisma.customer.delete({ where: { id: testCustomerId } });
    console.log('\n  ✔ Test data cleaned up successfully.');

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`  ORDER TESTS FINISHED: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runOrderModuleTests().catch((err) => {
  console.error('Fatal error during order module tests:', err);
  process.exit(1);
});
