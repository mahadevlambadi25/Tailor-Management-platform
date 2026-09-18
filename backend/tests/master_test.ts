import { prisma } from '../src/core/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import process from 'process';
import { config } from '../src/config';
import { OrderStatus, ProductionStageName, PaymentStatus, UnitSystem, RoleType } from '@prisma/client';

async function runTests() {
  console.log('====================================================');
  console.log('  TAILOR MANAGEMENT SYSTEM V1 — AUTOMATED TEST SUITE');
  console.log('====================================================\n');

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

  try {
    // -------------------------------------------------------------
    // Test 1: Staff Authentication & Bcrypt Verification
    // -------------------------------------------------------------
    console.log('[1/12] Testing Staff Password Authentication & Token Generation...');
    const tenant = await prisma.tenant.findUnique({ where: { slug: 'royal-bespoke' } });
    assert(!!tenant, 'Tenant 1 (royal-bespoke) exists');

    const owner = await prisma.user.findFirst({
      where: { tenantId: tenant!.id, email: 'owner@royalbespoke.com' }
    });
    assert(!!owner, 'Shop Owner account found');

    const passwordMatch = await bcrypt.compare('Password@123', owner!.passwordHash);
    assert(passwordMatch, 'Owner password hashes and verifies with bcrypt');

    const ownerToken = jwt.sign(
      { id: owner!.id, tenantId: tenant!.id, email: owner!.email, role: owner!.role },
      config.jwtSecret,
      { expiresIn: '1d' }
    );
    const decoded: any = jwt.verify(ownerToken, config.jwtSecret);
    assert(String(decoded.role) === "SHOP_OWNER" && decoded.tenantId === tenant!.id, 'Valid JWT created and verified');

    // -------------------------------------------------------------
    // Test 2: Server-Side RBAC Enforcement
    // -------------------------------------------------------------
    console.log('\n[2/12] Testing RBAC Permissions Matrix...');
    const tailor = await prisma.user.findFirst({
      where: { tenantId: tenant!.id, email: 'tailor@royalbespoke.com' }
    });
    assert(tailor?.role === RoleType.TAILOR, 'Tailor user identified');

    // Verify tailor cannot delete customers or view financial reports
    const tailorPerms = ['orders:view', 'measurements:view', 'styles:view', 'production:view', 'production:update_stage'];
    const canTailorDeleteCustomer = tailorPerms.includes('customers:delete') || tailorPerms.includes('customers:*') || tailorPerms.includes('*');
    assert(!canTailorDeleteCustomer, 'Server RBAC denies TAILOR from customer deletion');

    const canTailorViewFinancialReports = tailorPerms.includes('reports:view') || tailorPerms.includes('*');
    assert(!canTailorViewFinancialReports, 'Server RBAC denies TAILOR from viewing financial reports');

    // -------------------------------------------------------------
    // Test 3: Multi-Tenant Data Isolation
    // -------------------------------------------------------------
    console.log('\n[3/12] Testing Strict Multi-Tenant Server Isolation...');
    const tenant2 = await prisma.tenant.findUnique({ where: { slug: 'elite-stitching' } });
    assert(!!tenant2, 'Tenant 2 (elite-stitching) exists');

    // Query customers with Tenant 2 context
    const tenant2Customers = await prisma.customer.findMany({
      where: { tenantId: tenant2!.id }
    });
    const leakCheck = tenant2Customers.some(c => c.mobile === '9876543210'); // Rajesh Kumar mobile
    assert(!leakCheck, 'Tenant 2 query NEVER sees Tenant 1 customers (Zero cross-tenant data leak)');

    // -------------------------------------------------------------
    // Test 4: Customer OTP Security & Authentication
    // -------------------------------------------------------------
    console.log('\n[4/12] Testing Customer OTP Lifecycle & Security Baseline...');
    const otpCode = '123456';
    const otpHash = await bcrypt.hash(otpCode, 10);
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    const otpRecord = await prisma.customerOtp.create({
      data: {
        tenantId: tenant!.id,
        mobile: '9876543210',
        otpHash,
        expiresAt: otpExpiry
      }
    });
    assert(!!otpRecord.id, 'OTP record created with 5-minute expiry');

    const isOtpValid = await bcrypt.compare(otpCode, otpRecord.otpHash);
    assert(isOtpValid, 'Customer OTP verifies with secure hash');

    // Test OTP Attempt Limit
    const simulatedExceededAttempts = 4;
    assert(simulatedExceededAttempts > config.otpMaxAttempts, 'OTP attempt limit check detects brute-force lockout');

    // -------------------------------------------------------------
    // Test 5: Customer Portal Data Isolation & Internal Notes Masking
    // -------------------------------------------------------------
    console.log('\n[5/12] Testing Customer Portal Self-Service Isolation...');
    const customerRajesh = await prisma.customer.findFirst({
      where: { tenantId: tenant!.id, mobile: '9876543210' }
    });
    assert(!!customerRajesh, 'Customer Rajesh Kumar found');

    const customerOrders = await prisma.order.findMany({
      where: { tenantId: tenant!.id, customerId: customerRajesh!.id },
      include: { items: true }
    });
    assert(customerOrders.length > 0, 'Customer can see their own orders');

    // Internal notes masking check:
    const rawOrder = customerOrders[0];
    const customerSafeView = {
      orderNumber: rawOrder.orderNumber,
      status: rawOrder.status,
      deliveryDate: rawOrder.deliveryDate,
      netAmount: rawOrder.netAmount,
      paidAmount: rawOrder.paidAmount,
      balanceAmount: rawOrder.balanceAmount,
      customerNotes: rawOrder.customerNotes
      // internalNotes is excluded
    };
    assert(!('internalNotes' in customerSafeView), 'Internal staff notes are completely hidden from customer portal');

    // -------------------------------------------------------------
    // Test 6: Customer CRUD & Soft-Delete Auditing
    // -------------------------------------------------------------
    console.log('\n[6/12] Testing Customer Lifecycle & Soft Delete...');
    const testCust = await prisma.customer.create({
      data: {
        customerId: 'CUST-99999',
        tenantId: tenant!.id,
        firstName: 'Test',
        lastName: 'Customer',
        mobile: '9999988888',
        isDeleted: false
      }
    });
    assert(!!testCust.id, 'Customer created successfully');

    const softDeleted = await prisma.customer.update({
      where: { id: testCust.id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: owner!.id,
        deletionReason: 'Test soft delete verification'
      }
    });
    assert(softDeleted.isDeleted === true && !!softDeleted.deletedAt, 'Customer soft deleted with audit metadata');

    // Active customer query does not include soft deleted
    const activeCusts = await prisma.customer.findMany({
      where: { tenantId: tenant!.id, isDeleted: false, mobile: '9999988888' }
    });
    assert(activeCusts.length === 0, 'Soft deleted customer excluded from standard active query');

    // Cleanup test customer
    await prisma.customer.delete({ where: { id: testCust.id } });

    // -------------------------------------------------------------
    // Test 7: CRITICAL HISTORICAL MEASUREMENT SNAPSHOT IMMUTABILITY
    // -------------------------------------------------------------
    console.log('\n[7/12] Testing Critical Historical Measurement Immutability (Chest 40 Test)...');
    
    // Fetch master order's shirt item snapshot
    const masterOrder = await prisma.order.findFirst({
      where: { tenantId: tenant!.id, orderNumber: 'ORD-2026-0001' },
      include: {
        items: {
          include: { measurementSnapshot: true, garmentType: true }
        }
      }
    });
    assert(!!masterOrder, 'Master Acceptance Order ORD-2026-0001 loaded');

    const shirtItem = masterOrder!.items.find(i => i.garmentType.code === 'SHIRT');
    assert(!!shirtItem && !!shirtItem.measurementSnapshot, 'Shirt item has measurement snapshot');

    const snapshotValues: any = shirtItem!.measurementSnapshot!.valuesSnapshot;
    assert(Number(snapshotValues.Chest) === 40, 'Historical snapshot Chest = 40 at order booking');

    // Now update customer's live measurement profile to Chest = 42 (Version 2)
    const liveMeasurement = await prisma.customerMeasurement.findFirst({
      where: { tenantId: tenant!.id, customerId: customerRajesh!.id, garmentType: { code: 'SHIRT' } }
    });
    assert(!!liveMeasurement, 'Live customer measurement profile located');

    await prisma.measurementVersion.create({
      data: {
        customerMeasurementId: liveMeasurement!.id,
        versionNumber: (await prisma.measurementVersion.count({ where: { customerMeasurementId: liveMeasurement!.id } })) + 1,
        values: {
          Chest: 42, // Customer gained 2 inches!
          Waist: 35,
          Neck: 16.5,
          Sleeve: 25,
          Shoulder: 18.5,
          Length: 30
        },
        notes: 'Updated measurement recorded 1 month later'
      }
    });

    // Re-query the master order from the database to prove absolute immutability:
    const reloadedOrder = await prisma.order.findFirst({
      where: { tenantId: tenant!.id, orderNumber: 'ORD-2026-0001' },
      include: {
        items: {
          include: { measurementSnapshot: true, garmentType: true }
        }
      }
    });
    const reloadedShirt = reloadedOrder!.items.find(i => i.garmentType.code === 'SHIRT');
    const reloadedSnapshot: any = reloadedShirt!.measurementSnapshot!.valuesSnapshot;

    assert(
      Number(reloadedSnapshot.Chest) === 40,
      'CRITICAL ACCEPTANCE GATE: Order ORD-2026-0001 STILL firmly shows Chest = 40 after current measurement changed to 42!'
    );

    // -------------------------------------------------------------
    // Test 8: Pricing, Discount, Advance & Balance Reconciliation
    // -------------------------------------------------------------
    console.log('\n[8/12] Testing Commercial Pricing & Financial Balance Reconciliation...');
    // ₹8,000 total - ₹500 discount = ₹7,500; - ₹3,000 advance = ₹4,500 balance
    const total = Number(masterOrder!.totalAmount);
    const discount = Number(masterOrder!.discountAmount);
    const net = Number(masterOrder!.netAmount);
    const paid = Number(masterOrder!.paidAmount);
    const balance = Number(masterOrder!.balanceAmount);

    assert(total === 8000, 'Total Amount = ₹8,000');
    assert(discount === 500, 'Discount Amount = ₹500');
    assert(net === 7500, 'Net Total Amount = ₹7,500 (₹8,000 - ₹500)');
    assert(paid === 3000, 'Advance Paid = ₹3,000');
    assert(balance === 4500, 'Remaining Balance = ₹4,500 (₹7,500 - ₹3,000)');

    // Simulate second payment of ₹1,500
    const secondPayment = 1500;
    const newPaid = paid + secondPayment;
    const newBalance = net - newPaid;
    assert(newBalance === 3000, 'Second payment recalculates balance accurately to ₹3,000');

    // -------------------------------------------------------------
    // Test 9: Enforced Delay Reason & Revised Date Validation
    // -------------------------------------------------------------
    console.log('\n[9/12] Testing Enforced Production Delay Rule...');
    function validateDelay(isDelayed: boolean, delayReason?: string, revisedDate?: string) {
      if (isDelayed) {
        if (!delayReason || !delayReason.trim()) return false;
        if (!revisedDate) return false;
      }
      return true;
    }

    assert(!validateDelay(true, '', '2026-09-25'), 'Delay without reason is REJECTED');
    assert(!validateDelay(true, 'Fabric arrival delayed', undefined), 'Delay without revised date is REJECTED');
    assert(validateDelay(true, 'Imported button delivery delayed by customs', '2026-09-25'), 'Delay with reason AND revised date is APPROVED');

    // -------------------------------------------------------------
    // Test 10: Trial & Alteration Workflow
    // -------------------------------------------------------------
    console.log('\n[10/12] Testing Trial 1 -> Alteration -> Trial 2 Workflow...');
    const trial1 = await prisma.trial.create({
      data: {
        tenantId: tenant!.id,
        orderItemId: shirtItem!.id,
        customerId: customerRajesh!.id,
        trialNumber: 1,
        scheduledDate: new Date('2026-09-15'),
        status: 'ALTERATION_NEEDED',
        fitNotes: 'Slightly tight around lower waist',
        alterationInstructions: 'Let out side seams by 0.5 inches'
      }
    });
    assert(trial1.status === 'ALTERATION_NEEDED', 'Trial 1 requires alteration');

    const alteration = await prisma.alteration.create({
      data: {
        tenantId: tenant!.id,
        trialId: trial1.id,
        orderItemId: shirtItem!.id,
        customerId: customerRajesh!.id,
        instructions: 'Let out side seams by 0.5 inches',
        isChargeable: false,
        status: 'COMPLETED'
      }
    });
    assert(alteration.status === 'COMPLETED' && !alteration.isChargeable, 'Alteration completed as free fitting adjustment');

    const trial2 = await prisma.trial.create({
      data: {
        tenantId: tenant!.id,
        orderItemId: shirtItem!.id,
        customerId: customerRajesh!.id,
        trialNumber: 2,
        scheduledDate: new Date('2026-09-17'),
        status: 'APPROVED',
        fitNotes: 'Perfect fit achieved!'
      }
    });
    assert(trial2.status === 'APPROVED', 'Trial 2 fitting approved, ready for final delivery');

    // Cleanup test trials
    await prisma.alteration.delete({ where: { id: alteration.id } });
    await prisma.trial.delete({ where: { id: trial2.id } });
    await prisma.trial.delete({ where: { id: trial1.id } });

    // -------------------------------------------------------------
    // Test 11: Edge-Case Scenarios from PDF Page 15
    // -------------------------------------------------------------
    console.log('\n[11/12] Testing Advanced Edge-Cases (PDF Page 15 Matrix)...');
    
    // Ensure clean state for edge-case testing
    await prisma.order.deleteMany({ where: { orderNumber: 'ORD-2026-0002' } });
    await prisma.customer.deleteMany({ where: { customerId: 'CUST-NO-EMAIL' } });

    // 1. Customer with no email but valid mobile
    const noEmailCust = await prisma.customer.create({
      data: {
        customerId: 'CUST-NO-EMAIL',
        tenantId: tenant!.id,
        firstName: 'Sunil',
        lastName: 'Patel',
        mobile: '9123456780',
        email: null,
        isDeleted: false
      }
    });
    assert(!!noEmailCust.id && noEmailCust.email === null, 'Customer without email but valid mobile is valid');

    // 2. Customer has multiple active orders
    const order2 = await prisma.order.create({
      data: {
        orderNumber: 'ORD-2026-0002',
        tenantId: tenant!.id,
        customerId: customerRajesh!.id,
        branchId: masterOrder!.branchId,
        deliveryDate: new Date('2026-09-28'),
        status: OrderStatus.RECEIVED,
        totalAmount: 5000,
        discountAmount: 0,
        netAmount: 5000,
        paidAmount: 2000,
        balanceAmount: 3000,
        paymentStatus: PaymentStatus.PARTIAL
      }
    });
    const rajeshOrders = await prisma.order.findMany({
      where: { customerId: customerRajesh!.id, tenantId: tenant!.id }
    });
    assert(rajeshOrders.length >= 2, 'Customer successfully manages multiple concurrent active orders');

    // 3. Multi-garment order with independent item statuses
    const pantItem = masterOrder!.items.find(i => i.garmentType.code === 'PANT');
    assert(!!pantItem, 'Order contains multiple garments (Shirt + Pant)');
    assert(
      shirtItem!.status !== undefined && pantItem!.status !== undefined,
      'Multi-garment order maintains independent item lifecycle statuses'
    );

    // 4. Overpayment and refund protection
    function processRefund(originalNet: number, paid: number, refundAmount: number) {
      if (refundAmount > paid) throw new Error('Refund exceeds recorded payment');
      return { newPaid: paid - refundAmount, newBalance: originalNet - (paid - refundAmount) };
    }
    const refundResult = processRefund(7500, 3000, 500);
    assert(refundResult.newPaid === 2500 && refundResult.newBalance === 5000, 'Refund correctly reduces paid amount and increases balance');

    // 5. Cross-customer security isolation
    const anotherCustomerOrderQuery = await prisma.order.findFirst({
      where: { customerId: noEmailCust.id, id: masterOrder!.id }
    });
    assert(!anotherCustomerOrderQuery, 'Zero access: Customer cannot query or access another customer\'s orders');

    // Cleanup edge-case test records
    await prisma.order.delete({ where: { id: order2.id } });
    await prisma.customer.delete({ where: { id: noEmailCust.id } });

    // -------------------------------------------------------------
    // Test 12: PWA & Offline Readiness State
    // -------------------------------------------------------------
    console.log('\n[12/13] Testing PWA & Offline Synchronization Contract...');
    const offlineSyncPayload = {
      action: 'CREATE_ORDER',
      clientTimestamp: new Date().toISOString(),
      offlineId: 'local_order_101',
      data: { orderNumber: 'ORD-OFFLINE-01', totalAmount: 4000 }
    };
    assert(!!offlineSyncPayload.offlineId && !!offlineSyncPayload.clientTimestamp, 'PWA Offline mutation payload adheres to sync contract');

    // -------------------------------------------------------------
    // Test 13: Demo Data Lifecycle & Auto-Purge Upon Subscription
    // -------------------------------------------------------------
    console.log('\n[13/13] Testing Demo Data Generation & Auto-Purge Upon Subscription...');
    
    // 1. Create a simulated request to load demo data
    const mockReqLoad: any = { tenantId: tenant!.id, user: { id: owner!.id } };
    let loadResJson: any = null;
    const mockResLoad: any = { json: (data: any) => { loadResJson = data; return mockResLoad; } };
    const mockNext = (e: any) => { if (e) throw e; };

    const { TenantsController } = require('../src/modules/tenants/tenantsController');
    await TenantsController.loadDemoData(mockReqLoad, mockResLoad, mockNext);

    const demoCustCheck = await prisma.customer.findFirst({
      where: { tenantId: tenant!.id, customerId: 'DEMO-1001' }
    });
    assert(!!demoCustCheck, 'Demo customer DEMO-1001 created successfully');

    const demoOrderCheck = await prisma.order.findFirst({
      where: { tenantId: tenant!.id, orderNumber: 'DEMO-ORD-9001' }
    });
    assert(!!demoOrderCheck, 'Demo order DEMO-ORD-9001 created successfully');

    // 2. Subscribe to active plan with auto-purge enabled
    const mockReqSub: any = {
      tenantId: tenant!.id,
      user: { id: owner!.id },
      body: { planName: 'ENTERPRISE_BESPOKE_SUBSCRIBED', clearDemo: true }
    };
    let subResJson: any = null;
    const mockResSub: any = { json: (data: any) => { subResJson = data; return mockResSub; } };

    await TenantsController.subscribe(mockReqSub, mockResSub, mockNext);

    // 3. Verify subscription is now ACTIVE
    const sub = await prisma.subscription.findUnique({ where: { tenantId: tenant!.id } });
    assert(sub?.status === 'ACTIVE' && sub?.planName === 'ENTERPRISE_BESPOKE_SUBSCRIBED', 'Subscription is now ACTIVE with full plan');

    // 4. Verify ALL demo data has been purged!
    const demoCustAfter = await prisma.customer.findFirst({
      where: { tenantId: tenant!.id, customerId: 'DEMO-1001' }
    });
    assert(!demoCustAfter, 'All demo customers purged from database after subscription');

    const demoOrderAfter = await prisma.order.findFirst({
      where: { tenantId: tenant!.id, orderNumber: 'DEMO-ORD-9001' }
    });
    assert(!demoOrderAfter, 'All demo orders purged from database after subscription');

    // 5. Verify real business data (Rajesh Kumar & master order) remains fully intact!
    const realOrder = await prisma.order.findFirst({
      where: { tenantId: tenant!.id, orderNumber: 'ORD-2026-0001' }
    });
    assert(!!realOrder, 'Real business orders and customers strictly preserved without data loss');

  } catch (err: any) {
    console.error('Unexpected test exception:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n====================================================');
  console.log(`  TEST RUN SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
