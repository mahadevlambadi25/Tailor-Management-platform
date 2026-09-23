import { app } from '../src/app';
import { prisma } from '../src/core/prisma';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';
import { RoleType, OrderStatus, PaymentStatus, PaymentMethod } from '@prisma/client';
import http from 'http';

async function runPaymentModuleTests() {
  console.log('================================================================');
  console.log('  PAYMENT & BILLING MODULE — VERIFICATION & INTEGRATION SUITE   ');
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
    // Setup: Retrieve Test Tenants and Users with Distinct RBAC
    // -------------------------------------------------------------
    const tenant1 = await prisma.tenant.findUnique({ where: { slug: 'royal-bespoke' } });
    if (!tenant1) throw new Error('Tenant 1 (royal-bespoke) not found.');

    const tenant2 = await prisma.tenant.findUnique({ where: { slug: 'elite-stitching' } });
    if (!tenant2) throw new Error('Tenant 2 (elite-stitching) not found.');

    // Staff in Tenant 1
    const owner1 = await prisma.user.findFirst({
      where: { tenantId: tenant1.id, role: RoleType.SHOP_OWNER }
    });
    if (!owner1) throw new Error('Owner 1 not found.');

    const manager1 = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant1.id, email: 'manager1@royal.test' } },
      update: { role: RoleType.MANAGER, isActive: true },
      create: {
        tenantId: tenant1.id,
        name: 'Floor Manager Anjali',
        email: 'manager1@royal.test',
        passwordHash: 'dummy_hash',
        role: RoleType.MANAGER,
        isActive: true
      }
    });

    const cashier1 = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant1.id, email: 'cashier1@royal.test' } },
      update: { role: RoleType.CASHIER, isActive: true },
      create: {
        tenantId: tenant1.id,
        name: 'Desk Cashier Ravi',
        email: 'cashier1@royal.test',
        passwordHash: 'dummy_hash',
        role: RoleType.CASHIER,
        isActive: true
      }
    });

    const receptionist1 = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant1.id, email: 'receptionist1@royal.test' } },
      update: { role: RoleType.RECEPTIONIST, isActive: true },
      create: {
        tenantId: tenant1.id,
        name: 'Receptionist Pooja',
        email: 'receptionist1@royal.test',
        passwordHash: 'dummy_hash',
        role: RoleType.RECEPTIONIST,
        isActive: true
      }
    });

    const tailor1 = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant1.id, email: 'tailor_bill_test@royal.test' } },
      update: { role: RoleType.TAILOR, isActive: true },
      create: {
        tenantId: tenant1.id,
        name: 'Tailor Ramesh',
        email: 'tailor_bill_test@royal.test',
        passwordHash: 'dummy_hash',
        role: RoleType.TAILOR,
        isActive: true
      }
    });

    // Staff in Tenant 2
    const owner2 = await prisma.user.findFirst({
      where: { tenantId: tenant2.id, role: RoleType.SHOP_OWNER }
    });
    if (!owner2) throw new Error('Owner 2 not found.');

    // Generate JWT tokens
    const tokenOwner1 = jwt.sign(
      { id: owner1.id, tenantId: tenant1.id, email: owner1.email, role: owner1.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const tokenManager1 = jwt.sign(
      { id: manager1.id, tenantId: tenant1.id, email: manager1.email, role: manager1.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const tokenCashier1 = jwt.sign(
      { id: cashier1.id, tenantId: tenant1.id, email: cashier1.email, role: cashier1.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const tokenReceptionist1 = jwt.sign(
      { id: receptionist1.id, tenantId: tenant1.id, email: receptionist1.email, role: receptionist1.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const tokenTailor1 = jwt.sign(
      { id: tailor1.id, tenantId: tenant1.id, email: tailor1.email, role: tailor1.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const tokenOwner2 = jwt.sign(
      { id: owner2.id, tenantId: tenant2.id, email: owner2.email, role: owner2.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Retrieve master garment
    const garments = await prisma.garmentType.findMany();
    const testGarment = garments[0];

    // Create a dedicated test customer for billing testing
    const testMobile = '9876223344';
    let customer = await prisma.customer.findFirst({
      where: { tenantId: tenant1.id, mobile: testMobile }
    });
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          tenantId: tenant1.id,
          customerId: 'CUST-PAY-01',
          firstName: 'Vikram',
          lastName: 'Mehta',
          mobile: testMobile,
          email: 'vikram.mehta@example.com',
          city: 'Bangalore'
        }
      });
    }

    // Create an order with exact known figures:
    // Total gross = 5000, discount = 500, gst 18% on 4500 = 810. Net Amount = 5310.
    const createOrderRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner1}`
      },
      body: JSON.stringify({
        customerId: customer.id,
        deliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        priority: 'REGULAR',
        discountType: 'FIXED',
        discountValue: 500,
        gstRate: 18,
        isGstInclusive: false,
        items: [
          {
            garmentTypeId: testGarment.id,
            itemPrice: 3000,
            stitchingCharge: 1500,
            fabricCharge: 500,
            quantity: 1,
            measurementSnapshot: { unit: 'INCHES', valuesSnapshot: { chest: 40, waist: 34 } }
          }
        ]
      })
    });

    const orderData = (await createOrderRes.json()) as any;
    assert(createOrderRes.ok && orderData.success, 'Test Setup: Created initial order for payment tests');
    const orderId = orderData.data.id;
    const orderNumber = orderData.data.orderNumber;

    assert(
      Number(orderData.data.totalAmount) === 5000 &&
        Number(orderData.data.discountAmount) === 500 &&
        Number(orderData.data.gstAmount) === 810 &&
        Number(orderData.data.netAmount) === 5310 &&
        Number(orderData.data.balanceAmount) === 5310 &&
        orderData.data.paymentStatus === PaymentStatus.UNPAID,
      'Centralized Billing: Initial math verified (Gross 5000 - Discount 500 + GST 810 = Net 5310, Balance 5310)'
    );

    // =========================================================================
    // TEST 1: Validation Rules — Negative, Zero, and Invalid Payment Amounts
    // =========================================================================
    console.log('\n--- Section 1: Payment Amount Validation Tests ---');

    // 1.1 Zero amount
    const zeroRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCashier1}`
      },
      body: JSON.stringify({
        orderId,
        amount: 0,
        paymentMethod: 'CASH'
      })
    });
    const zeroData = (await zeroRes.json()) as any;
    assert(
      zeroRes.status === 400 && zeroData.error?.code === 'INVALID_AMOUNT',
      'Validation: Rejects payment amount = 0 with INVALID_AMOUNT'
    );

    // 1.2 Negative amount
    const negRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCashier1}`
      },
      body: JSON.stringify({
        orderId,
        amount: -500,
        paymentMethod: 'UPI'
      })
    });
    const negData = (await negRes.json()) as any;
    assert(
      negRes.status === 400 && negData.error?.code === 'INVALID_AMOUNT',
      'Validation: Rejects negative payment amount with INVALID_AMOUNT'
    );

    // 1.3 Invalid payment method
    const invalidMethodRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCashier1}`
      },
      body: JSON.stringify({
        orderId,
        amount: 1000,
        paymentMethod: 'BITCOIN'
      })
    });
    const invalidMethodData = (await invalidMethodRes.json()) as any;
    assert(
      invalidMethodRes.status === 400 && invalidMethodData.error?.code === 'INVALID_PAYMENT_METHOD',
      'Validation: Rejects unsupported payment method with INVALID_PAYMENT_METHOD'
    );

    // =========================================================================
    // TEST 2: Overpayment Validation
    // =========================================================================
    console.log('\n--- Section 2: Overpayment Protection Tests ---');

    // Remaining balance is 5310. Try paying 6000.
    const overpayRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCashier1}`
      },
      body: JSON.stringify({
        orderId,
        amount: 6000,
        paymentMethod: 'UPI'
      })
    });
    const overpayData = (await overpayRes.json()) as any;
    assert(
      overpayRes.status === 400 && overpayData.error?.code === 'EXCEEDS_BALANCE',
      'Validation: Overpayment (amount > balance) strictly rejected with EXCEEDS_BALANCE',
      overpayData.error?.message
    );

    // =========================================================================
    // TEST 3: Partial Payment 1 (Advance Intake via UPI)
    // =========================================================================
    console.log('\n--- Section 3: Partial Advance Payment Intake ---');

    const pay1Res = await fetch(`${baseUrl}/orders/${orderId}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCashier1}`
      },
      body: JSON.stringify({
        amount: 2000,
        paymentMethod: 'UPI',
        referenceNumber: 'UPI-TXN-998877',
        notes: 'Advance deposit at store counter'
      })
    });
    const pay1Data = (await pay1Res.json()) as any;

    assert(pay1Res.ok && pay1Data.success, 'Partial Payment: Advance payment of ₹2,000 recorded via POST /orders/:orderId/payments');
    const payment1 = pay1Data.data;

    assert(
      payment1.receipt && payment1.receipt.receiptNumber.startsWith('REC-'),
      `Receipt: Automatic receipt generated with number "${payment1.receipt?.receiptNumber}"`
    );

    assert(
      payment1.updatedOrder &&
        Number(payment1.updatedOrder.paidAmount) === 2000 &&
        Number(payment1.updatedOrder.balanceAmount) === 3310 &&
        payment1.updatedOrder.paymentStatus === PaymentStatus.PARTIAL,
      'Centralized Balance: Order updated to paid=2000, balance=3310, status=PARTIAL'
    );

    // Verify AuditLog for PAYMENT_RECORDED
    const payAudit = await prisma.auditLog.findFirst({
      where: {
        tenantId: tenant1.id,
        action: 'PAYMENT_RECORDED',
        entityId: payment1.id
      }
    });
    assert(Boolean(payAudit), 'Audit Trail: PAYMENT_RECORDED audit log created with user and payment details');

    // =========================================================================
    // TEST 4: Multiple Payments — Second Partial Installment (Cash)
    // =========================================================================
    console.log('\n--- Section 4: Multiple Payments Accumulation ---');

    const pay2Res = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenReceptionist1}`
      },
      body: JSON.stringify({
        orderId,
        amount: 1310,
        paymentMethod: 'CASH',
        notes: 'Fitting trial installment paid in cash'
      })
    });
    const pay2Data = (await pay2Res.json()) as any;
    assert(pay2Res.ok && pay2Data.success, 'Multiple Payments: Second installment of ₹1,310 recorded by Receptionist');

    assert(
      pay2Data.data.updatedOrder &&
        Number(pay2Data.data.updatedOrder.paidAmount) === 3310 &&
        Number(pay2Data.data.updatedOrder.balanceAmount) === 2000 &&
        pay2Data.data.updatedOrder.paymentStatus === PaymentStatus.PARTIAL,
      'Centralized Balance: Cumulative paid=3310, remaining balance=2000'
    );

    // Overpayment check on reduced balance: remaining is 2000, try paying 2001
    const overpay2Res = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCashier1}`
      },
      body: JSON.stringify({
        orderId,
        amount: 2001,
        paymentMethod: 'CASH'
      })
    });
    assert(overpay2Res.status === 400, 'Validation: Overpayment of ₹2,001 on remaining balance of ₹2,000 rejected');

    // =========================================================================
    // TEST 5: Full Payment Settlement (CARD)
    // =========================================================================
    console.log('\n--- Section 5: Full Settlement & Zero Balance ---');

    const pay3Res = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCashier1}`
      },
      body: JSON.stringify({
        orderId,
        amount: 2000,
        paymentMethod: 'CARD',
        referenceNumber: 'POS-AUTH-4411',
        notes: 'Final balance settlement swipe'
      })
    });
    const pay3Data = (await pay3Res.json()) as any;
    const payment3 = pay3Data.data;

    assert(pay3Res.ok && pay3Data.success, 'Full Payment: Exact balance of ₹2,000 recorded via CARD');
    assert(
      payment3.updatedOrder &&
        Number(payment3.updatedOrder.paidAmount) === 5310 &&
        Number(payment3.updatedOrder.balanceAmount) === 0 &&
        payment3.updatedOrder.paymentStatus === PaymentStatus.PAID,
      'Centralized Balance: Order is PAID with balance=0 and paid=5310'
    );

    // Attempting any further payment when balance = 0 must fail
    const postSettledRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCashier1}`
      },
      body: JSON.stringify({
        orderId,
        amount: 100,
        paymentMethod: 'CASH'
      })
    });
    const postSettledData = (await postSettledRes.json()) as any;
    assert(
      postSettledRes.status === 400 && postSettledData.error?.code === 'EXCEEDS_BALANCE',
      'Validation: Rejects payment against fully settled order (balance is already 0)'
    );

    // =========================================================================
    // TEST 6: Payment History & Order Billing API
    // =========================================================================
    console.log('\n--- Section 6: Payment History & Billing Calculation ---');

    const historyRes = await fetch(`${baseUrl}/orders/${orderId}/payments`, {
      headers: { Authorization: `Bearer ${tokenCashier1}` }
    });
    const historyData = (await historyRes.json()) as any;

    assert(historyRes.ok && historyData.success, 'History API: GET /orders/:orderId/payments returns 200 OK');
    assert(
      historyData.data.payments.length === 3,
      `History API: Returns all 3 payment records (found ${historyData.data.payments.length})`
    );

    const bSummary = historyData.data.billingSummary;
    assert(
      bSummary.netAmount === 5310 &&
        bSummary.paidAmount === 5310 &&
        bSummary.balanceAmount === 0 &&
        bSummary.paymentStatus === PaymentStatus.PAID,
      'History API: billingSummary matches exact calculation formula (Net 5310, Paid 5310, Bal 0, PAID)'
    );

    // List payments endpoint with search and filter
    const listRes = await fetch(`${baseUrl}/payments?orderId=${orderId}`, {
      headers: { Authorization: `Bearer ${tokenCashier1}` }
    });
    const listData = (await listRes.json()) as any;
    assert(
      listRes.ok && listData.data.length === 3,
      'List API: GET /payments?orderId= returns tenant-scoped payments'
    );

    // Filter by paymentMethod
    const upiListRes = await fetch(`${baseUrl}/payments?orderId=${orderId}&paymentMethod=UPI`, {
      headers: { Authorization: `Bearer ${tokenCashier1}` }
    });
    const upiListData = (await upiListRes.json()) as any;
    assert(
      upiListRes.ok && upiListData.data.length === 1 && upiListData.data[0].paymentMethod === 'UPI',
      'List API: Filters correctly by paymentMethod=UPI'
    );

    // Get single payment by ID
    const singleRes = await fetch(`${baseUrl}/payments/${payment1.id}`, {
      headers: { Authorization: `Bearer ${tokenCashier1}` }
    });
    const singleData = (await singleRes.json()) as any;
    assert(
      singleRes.ok && singleData.data.id === payment1.id && singleData.data.receipts.length > 0,
      'Single Payment API: GET /payments/:id includes order, customer, receipts, and staff'
    );

    // =========================================================================
    // TEST 7: RBAC — Role Boundaries & Cancellation Permission
    // =========================================================================
    console.log('\n--- Section 7: RBAC Authorization Tests ---');

    // 7.1 TAILOR cannot record payments
    const tailorPayRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenTailor1}`
      },
      body: JSON.stringify({
        orderId,
        amount: 100,
        paymentMethod: 'CASH'
      })
    });
    assert(tailorPayRes.status === 403, 'RBAC: TAILOR role forbidden from recording payments (403)');

    // 7.2 CASHIER cannot cancel payments (Only SHOP_OWNER & MANAGER)
    const cashierCancelRes = await fetch(`${baseUrl}/payments/${payment3.id}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCashier1}`
      },
      body: JSON.stringify({ reason: 'Cashier trying to cancel' })
    });
    assert(cashierCancelRes.status === 403, 'RBAC: CASHIER role forbidden from cancelling payments (403)');

    // 7.3 RECEPTIONIST cannot cancel payments
    const recCancelRes = await fetch(`${baseUrl}/payments/${payment3.id}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenReceptionist1}`
      },
      body: JSON.stringify({ reason: 'Receptionist trying to cancel' })
    });
    assert(recCancelRes.status === 403, 'RBAC: RECEPTIONIST role forbidden from cancelling payments (403)');

    // =========================================================================
    // TEST 8: Financial Cancellation & Double-Entry Reversal Accounting
    // =========================================================================
    console.log('\n--- Section 8: Financial Reversal & Double-Entry Accounting ---');

    // 8.1 Cancellation missing reason rejected
    const noReasonRes = await fetch(`${baseUrl}/payments/${payment3.id}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner1}`
      },
      body: JSON.stringify({ reason: '   ' })
    });
    assert(
      noReasonRes.status === 400,
      'Audit Rule: Payment cancellation requires mandatory non-empty reason'
    );

    // 8.2 Shop Owner cancels payment 3 (₹2,000 card payment)
    const cancelRes = await fetch(`${baseUrl}/payments/${payment3.id}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner1}`
      },
      body: JSON.stringify({
        reason: 'Customer card swipe failed on bank network; customer paid later'
      })
    });
    const cancelData = (await cancelRes.json()) as any;

    assert(cancelRes.ok && cancelData.success, 'Reversal: Shop Owner successfully cancelled payment');

    // Verify original payment preserved and marked as correction
    const originalPaymentAfter = await prisma.payment.findUnique({
      where: { id: payment3.id }
    });
    assert(
      originalPaymentAfter !== null && originalPaymentAfter.isCorrection === true,
      'Double-Entry Accounting: Original payment preserved with isCorrection=true (no hard delete)'
    );

    // Verify offsetting reversal entry created
    const reversalEntry = cancelData.data.reversal;
    assert(
      reversalEntry &&
        reversalEntry.isRefund === true &&
        reversalEntry.isCorrection === true &&
        Number(reversalEntry.amount) === 2000,
      'Double-Entry Accounting: Offsetting reversal payment entry created with isRefund=true and amount=2000'
    );

    // Verify order balance recalculated back to ₹2,000
    const orderAfterCancel = await prisma.order.findUnique({ where: { id: orderId } });
    assert(
      orderAfterCancel !== null &&
        Number(orderAfterCancel.paidAmount) === 3310 &&
        Number(orderAfterCancel.balanceAmount) === 2000 &&
        orderAfterCancel.paymentStatus === PaymentStatus.PARTIAL,
      'Centralized Balance: Order recalculated after reversal (paid=3310, balance=2000, status=PARTIAL)'
    );

    // Verify audit log for PAYMENT_CANCELLED
    const cancelAudit = await prisma.auditLog.findFirst({
      where: {
        tenantId: tenant1.id,
        action: 'PAYMENT_CANCELLED',
        entityId: payment3.id
      }
    });
    assert(
      Boolean(cancelAudit) && (cancelAudit?.details as any)?.cancellationReason.includes('card swipe failed'),
      'Audit Trail: PAYMENT_CANCELLED audit log records cancellation reason and user details'
    );

    // 8.3 Double cancellation blocked
    const doubleCancelRes = await fetch(`${baseUrl}/payments/${payment3.id}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner1}`
      },
      body: JSON.stringify({ reason: 'Trying to cancel again' })
    });
    assert(
      doubleCancelRes.status === 400,
      'Validation: Rejects cancelling a payment that is already cancelled (ALREADY_CANCELLED)'
    );

    // 8.4 Cannot cancel a reversal
    const cancelReversalRes = await fetch(`${baseUrl}/payments/${reversalEntry.id}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner1}`
      },
      body: JSON.stringify({ reason: 'Trying to cancel a reversal' })
    });
    assert(
      cancelReversalRes.status === 400,
      'Validation: Rejects cancelling a reversal voucher entry (CANNOT_CANCEL_REVERSAL)'
    );

    // =========================================================================
    // TEST 9: Tenant Isolation & Multi-Tenant Boundaries
    // =========================================================================
    console.log('\n--- Section 9: Strict Tenant Isolation Tests ---');

    // 9.1 Tenant 2 user attempts to view Tenant 1 payment by ID -> 404
    const crossGetRes = await fetch(`${baseUrl}/payments/${payment1.id}`, {
      headers: { Authorization: `Bearer ${tokenOwner2}` }
    });
    assert(crossGetRes.status === 404, 'Tenant Isolation: Cross-tenant GET /payments/:id returns 404');

    // 9.2 Tenant 2 user attempts to record payment on Tenant 1 order -> 404
    const crossPostRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner2}`
      },
      body: JSON.stringify({
        orderId,
        amount: 500,
        paymentMethod: 'CASH'
      })
    });
    assert(crossPostRes.status === 404, 'Tenant Isolation: Cross-tenant POST /payments returns 404');

    // 9.3 Tenant 2 user attempts to cancel Tenant 1 payment -> 404
    const crossCancelRes = await fetch(`${baseUrl}/payments/${payment1.id}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwner2}`
      },
      body: JSON.stringify({ reason: 'Malicious cross-tenant cancellation' })
    });
    assert(crossCancelRes.status === 404, 'Tenant Isolation: Cross-tenant POST /payments/:id/cancel returns 404');

    // 9.4 Tenant 2 listing payments returns zero payments from Tenant 1
    const t2ListRes = await fetch(`${baseUrl}/payments?search=${orderNumber}`, {
      headers: { Authorization: `Bearer ${tokenOwner2}` }
    });
    const t2ListData = (await t2ListRes.json()) as any;
    assert(
      t2ListRes.ok && t2ListData.data.length === 0,
      'Tenant Isolation: Cross-tenant search returns 0 results for another tenant order'
    );

    // =========================================================================
    // TEST 10: Production & Delivery Integration
    // =========================================================================
    console.log('\n--- Section 10: Delivery & Production Board Financial Integration ---');

    // Fetch production board and verify order financial fields are included
    const boardRes = await fetch(`${baseUrl}/production/board`, {
      headers: { Authorization: `Bearer ${tokenOwner1}` }
    });
    const boardData = (await boardRes.json()) as any;

    assert(boardRes.ok && boardData.success, 'Production Integration: GET /production/board returns 200 OK');

    // Find the job for our test order
    let foundOrderFinancials = false;
    for (const stageKey of Object.keys(boardData.data)) {
      const jobs = boardData.data[stageKey];
      for (const job of jobs) {
        if (job.orderItem?.order?.orderNumber === orderNumber) {
          const ord = job.orderItem.order;
          if (
            ord.paymentStatus !== undefined &&
            ord.paidAmount !== undefined &&
            ord.balanceAmount !== undefined &&
            ord.netAmount !== undefined
          ) {
            foundOrderFinancials = true;
            assert(
              ord.paymentStatus === PaymentStatus.PARTIAL && Number(ord.balanceAmount) === 2000,
              `Delivery Integration: Workshop board includes exact payment status (${ord.paymentStatus}) and balance due (${ord.balanceAmount})`
            );
            break;
          }
        }
      }
      if (foundOrderFinancials) break;
    }

    assert(foundOrderFinancials, 'Delivery Integration: Workshop board delivers full order financial context to staff before delivery');

  } catch (err: any) {
    console.error('\n❌ Unhandled Exception in Payment Test Suite:', err);
    failed++;
  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`  PAYMENT TESTS COMPLETE: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPaymentModuleTests().catch((e) => {
  console.error('Fatal error running payments module test suite:', e);
  process.exit(1);
});
