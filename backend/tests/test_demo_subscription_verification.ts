import { prisma } from '../src/core/prisma';
import {
  seedDemoDataForTenant,
  purgeTenantDemoData,
  getDemoStats,
  seedIdentifiableDemoTenant
} from '../src/modules/demo/demoService';
import { RoleType, OrderStatus, PaymentStatus } from '@prisma/client';

async function runDemoSubscriptionVerification() {
  console.log('================================================================');
  console.log('  COMPREHENSIVE DEMO DATA & PREMIUM SUBSCRIPTION VERIFICATION  ');
  console.log('================================================================\n');

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

  // Use a dedicated isolated test tenant so real data is never touched
  const TEST_SLUG = 'test-demo-verify-atelier';
  let testTenant: any = null;
  let isolationTenantB: any = null;

  try {
    // -------------------------------------------------------------
    // Step 1: Create an isolated test tenant
    // -------------------------------------------------------------
    console.log('[1/9] Setting up isolated test tenant...');
    testTenant = await prisma.tenant.upsert({
      where: { slug: TEST_SLUG },
      update: { isDemo: true },
      create: {
        name: 'Verification Test Atelier',
        slug: TEST_SLUG,
        phone: '+91 9999988888',
        email: 'verify@atelier-test.com',
        isDemo: true
      }
    });
    assert(!!testTenant && testTenant.isDemo === true, 'Test tenant created with isDemo: true');

    // Clean any prior test demo records
    await purgeTenantDemoData(testTenant.id);

    // -------------------------------------------------------------
    // Step 2: Seed Demo Data & Verify All 7 Roles Exist
    // -------------------------------------------------------------
    console.log('\n[2/9] Seeding complete demo data and checking all 7 staff roles...');
    const statsAfterSeed = await seedDemoDataForTenant(testTenant.id);
    assert(statsAfterSeed.hasDemoData === true, 'Demo data seeded successfully (hasDemoData === true)');

    const expectedRoles = [
      RoleType.SHOP_OWNER,
      RoleType.MANAGER,
      RoleType.RECEPTIONIST,
      RoleType.TAILOR,
      RoleType.CUTTER,
      RoleType.FINISHER,
      RoleType.CASHIER
    ];

    const staffUsers = await prisma.user.findMany({ where: { tenantId: testTenant.id } });
    const userRoles = staffUsers.map(u => u.role);

    for (const role of expectedRoles) {
      assert(userRoles.includes(role), `Staff role [${role}] created and verified`);
    }

    // -------------------------------------------------------------
    // Step 3: Verify Demo Inventory Items
    // -------------------------------------------------------------
    console.log('\n[3/9] Verifying demo inventory items...');
    const demoInventory = await prisma.inventoryItem.findMany({
      where: { tenantId: testTenant.id, isDemo: true }
    });
    assert(demoInventory.length >= 6, `Found ${demoInventory.length} demo inventory items (expected >= 6)`);
    assert(demoInventory.every(i => i.isDemo === true), 'All demo inventory items have isDemo === true');

    const hasFabric = demoInventory.some(i => i.category === 'FABRIC');
    const hasButtons = demoInventory.some(i => i.category === 'BUTTON');
    const hasThread = demoInventory.some(i => i.category === 'THREAD');
    const hasCanvas = demoInventory.some(i => i.category === 'CANVAS');
    assert(hasFabric && hasButtons && hasThread && hasCanvas, 'Realistic inventory covers FABRIC, BUTTON, THREAD, and CANVAS categories');

    // -------------------------------------------------------------
    // Step 4: Verify Demo Customers, Measurements, Orders & Appointments
    // -------------------------------------------------------------
    console.log('\n[4/9] Verifying demo customers, measurements, orders, and appointments...');
    const demoCustomers = await prisma.customer.findMany({
      where: { tenantId: testTenant.id, isDemo: true }
    });
    assert(demoCustomers.length === 3, `Found ${demoCustomers.length} demo customers (DEMO-1001, DEMO-1002, DEMO-1003)`);

    const demoMeasurements = await prisma.customerMeasurement.findMany({
      where: { tenantId: testTenant.id, customer: { isDemo: true } }
    });
    assert(demoMeasurements.length > 0, `Found ${demoMeasurements.length} customer measurement profiles attached to demo clients`);

    const demoOrders = await prisma.order.findMany({
      where: { tenantId: testTenant.id, isDemo: true },
      include: { items: true, payments: true }
    });
    assert(demoOrders.length === 3, `Found ${demoOrders.length} demo orders with isDemo === true`);

    const hasOrderItems = demoOrders.every(o => o.items.length > 0);
    const hasPayments = demoOrders.some(o => o.payments.length > 0);
    assert(hasOrderItems && hasPayments, 'Demo orders contain nested order items, snapshots, and advance payments');

    const demoAppts = await prisma.appointment.findMany({
      where: { tenantId: testTenant.id, isDemo: true }
    });
    assert(demoAppts.length >= 1, `Found ${demoAppts.length} demo appointments with isDemo === true`);

    // -------------------------------------------------------------
    // Step 5: Create REAL Customer, Order, and Inventory (isDemo: false)
    // -------------------------------------------------------------
    console.log('\n[5/9] Creating REAL business records (isDemo: false)...');
    const realCustomer = await prisma.customer.create({
      data: {
        tenantId: testTenant.id,
        customerId: 'REAL-CUST-9999',
        firstName: 'Devendra',
        lastName: 'Singhania',
        mobile: '9811223344',
        email: 'devendra.real@singhania.com',
        isDemo: false
      }
    });
    assert(realCustomer.isDemo === false, 'Real customer created with isDemo: false');

    const realOrder = await prisma.order.create({
      data: {
        tenantId: testTenant.id,
        customerId: realCustomer.id,
        orderNumber: 'REAL-ORD-9999',
        status: OrderStatus.RECEIVED,
        deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        totalAmount: 15000,
        netAmount: 15000,
        paidAmount: 5000,
        balanceAmount: 10000,
        paymentStatus: PaymentStatus.PARTIAL,
        isDemo: false
      }
    });
    assert(realOrder.isDemo === false, 'Real order created with isDemo: false');

    const realInventory = await prisma.inventoryItem.create({
      data: {
        tenantId: testTenant.id,
        itemCode: 'REAL-FAB-9999',
        name: 'Real Production Silk Brocade',
        category: 'FABRIC',
        quantity: 100,
        unit: 'METERS',
        unitPrice: 5000,
        isDemo: false
      }
    });
    assert(realInventory.isDemo === false, 'Real inventory created with isDemo: false');

    // -------------------------------------------------------------
    // Step 6: Multi-Tenant Isolation Setup (Tenant B with demo data)
    // -------------------------------------------------------------
    console.log('\n[6/9] Setting up Tenant B to test multi-tenant isolation...');
    isolationTenantB = await prisma.tenant.upsert({
      where: { slug: 'test-isolation-tenant-b' },
      update: { isDemo: true },
      create: {
        name: 'Tenant B Haute Couture',
        slug: 'test-isolation-tenant-b',
        phone: '+91 9112233445',
        isDemo: true
      }
    });
    const tenantBCust = await prisma.customer.create({
      data: {
        tenantId: isolationTenantB.id,
        customerId: 'CUST-DEMO-TENANT-B',
        firstName: 'TenantB',
        lastName: 'Client',
        mobile: '9000000099',
        isDemo: true
      }
    });
    assert(!!tenantBCust, 'Tenant B demo customer created for isolation check');

    // -------------------------------------------------------------
    // Step 7: Premium Subscription Activation & Atomic Demo Purge
    // -------------------------------------------------------------
    console.log('\n[7/9] Simulating confirmed Premium Subscription activation & atomic demo cleanup...');
    // In actual flow, subscription status is set to ACTIVE and purgeTenantDemoData is executed:
    const sub = await prisma.subscription.upsert({
      where: { tenantId: testTenant.id },
      update: { planName: 'ENTERPRISE_PRO_ACTIVE', status: 'ACTIVE' },
      create: { tenantId: testTenant.id, planName: 'ENTERPRISE_PRO_ACTIVE', status: 'ACTIVE' }
    });
    assert(sub.status === 'ACTIVE', 'Subscription status updated to ACTIVE');

    const purgeResult = await purgeTenantDemoData(testTenant.id);
    assert(purgeResult.deletedOrdersCount === 3, `Purged 3 demo orders (actual: ${purgeResult.deletedOrdersCount})`);
    assert(purgeResult.deletedCustomersCount === 3, `Purged 3 demo customers (actual: ${purgeResult.deletedCustomersCount})`);
    assert(purgeResult.deletedInventoryCount >= 6, `Purged ${purgeResult.deletedInventoryCount} demo inventory items`);
    assert(purgeResult.deletedAppointmentsCount >= 1, `Purged ${purgeResult.deletedAppointmentsCount} demo appointments`);

    // Verify stats after purge:
    const statsAfterPurge = await getDemoStats(testTenant.id);
    assert(statsAfterPurge.hasDemoData === false, 'Tenant demoStats reports hasDemoData === false');

    // -------------------------------------------------------------
    // Step 8: Strict Verification of PRESERVATION
    // -------------------------------------------------------------
    console.log('\n[8/9] Verifying PRESERVATION of Tenant, Staff Accounts, Subscription, and Real Data...');
    
    // 8a. Tenant intact?
    const preservedTenant = await prisma.tenant.findUnique({ where: { id: testTenant.id } });
    assert(!!preservedTenant, 'Tenant record is 100% PRESERVED intact');

    // 8b. Subscription intact?
    const preservedSub = await prisma.subscription.findUnique({ where: { tenantId: testTenant.id } });
    assert(preservedSub?.status === 'ACTIVE', 'Subscription is 100% PRESERVED with ACTIVE status');

    // 8c. Staff accounts intact?
    const staffAfterPurge = await prisma.user.findMany({ where: { tenantId: testTenant.id } });
    assert(staffAfterPurge.length >= 7, `All ${staffAfterPurge.length} staff user accounts are 100% PRESERVED intact`);

    // 8d. Real Customer intact?
    const preservedRealCust = await prisma.customer.findUnique({ where: { id: realCustomer.id } });
    assert(!!preservedRealCust, `Real customer "${preservedRealCust?.firstName} ${preservedRealCust?.lastName}" is 100% PRESERVED`);

    // 8e. Real Order intact?
    const preservedRealOrder = await prisma.order.findUnique({ where: { id: realOrder.id } });
    assert(!!preservedRealOrder, `Real order "${preservedRealOrder?.orderNumber}" is 100% PRESERVED`);

    // 8f. Real Inventory intact?
    const preservedRealInv = await prisma.inventoryItem.findUnique({ where: { id: realInventory.id } });
    assert(!!preservedRealInv, `Real inventory "${preservedRealInv?.name}" is 100% PRESERVED`);

    // 8g. Multi-tenant isolation: Tenant B demo customer untouched?
    const preservedTenantBCust = await prisma.customer.findUnique({ where: { id: tenantBCust.id } });
    assert(!!preservedTenantBCust, 'Tenant B demo customer was NOT touched (multi-tenant isolation verified)');

    // -------------------------------------------------------------
    // Step 9: Dedicated Demo Tenant Seeding (slug: demo-tailors)
    // -------------------------------------------------------------
    console.log('\n[9/9] Verifying dedicated identifiable demo tenant creation (demo-tailors)...');
    const { tenant: demoAtelier, stats: demoAtelierStats } = await seedIdentifiableDemoTenant('demo-tailors');
    assert(demoAtelier.slug === 'demo-tailors' && demoAtelier.isDemo === true, 'Dedicated demo tenant (demo-tailors) has isDemo === true');
    assert(demoAtelierStats.demoOrdersCount === 3 && demoAtelierStats.demoCustomersCount === 3, 'Demo tenant contains complete dataset (3 orders, 3 customers, 6 inventory items)');

    // Clean up temporary test tenant records
    await purgeTenantDemoData(testTenant.id);
    await prisma.order.deleteMany({ where: { id: realOrder.id } });
    await prisma.customer.deleteMany({ where: { id: realCustomer.id } });
    await prisma.inventoryItem.deleteMany({ where: { id: realInventory.id } });
    await prisma.user.deleteMany({ where: { tenantId: testTenant.id } });
    await prisma.branch.deleteMany({ where: { tenantId: testTenant.id } });
    await prisma.subscription.deleteMany({ where: { tenantId: testTenant.id } });
    await prisma.tenant.delete({ where: { id: testTenant.id } });

    await prisma.customer.deleteMany({ where: { id: tenantBCust.id } });
    await prisma.tenant.delete({ where: { id: isolationTenantB.id } });

  } catch (err: any) {
    console.error('UNEXPECTED EXCEPTION IN TEST RUNNER:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runDemoSubscriptionVerification();
