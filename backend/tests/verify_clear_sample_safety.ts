import { prisma } from '../src/core/prisma';
import { SampleDataService } from '../src/modules/conversion/sampleDataService';
import assert from 'assert';

async function testClearSampleSafety() {
  console.log('====================================================');
  console.log('  TESTING CLEAR SAMPLE DATA SAFETY SPECIFICATION   ');
  console.log('====================================================\n');

  // 1. Create an isolated test tenant
  const tenantSlug = `clear-test-${Date.now()}`;
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Clear Sample Test Atelier',
      slug: tenantSlug,
      email: `${tenantSlug}@example.com`,
      phone: '9991112223'
    }
  });

  const branch = await prisma.branch.create({
    data: {
      tenantId: tenant.id,
      name: 'Main Workshop',
      code: `MAIN-${Date.now()}`,
      isMain: true
    }
  });

  console.log('[1/4] Populating 5 Sample Customers & 5 Real Customers...');
  // 5 Sample Customers
  for (let i = 1; i <= 5; i++) {
    await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        customerId: `SMP-CUST-${1000 + i}`,
        firstName: `SampleCust${i}`,
        lastName: 'Demo',
        mobile: `888000000${i}`,
        gender: 'MALE',
        isSample: true
      }
    });
  }

  // 5 Real Customers
  const realCustomers = [];
  for (let i = 1; i <= 5; i++) {
    const cust = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        customerId: `REAL-CUST-${2000 + i}`,
        firstName: `RealCust${i}`,
        lastName: 'Sharma',
        mobile: `999000000${i}`,
        gender: 'MALE',
        isSample: false
      }
    });
    realCustomers.push(cust);
  }

  console.log('[2/4] Populating 5 Sample Orders & 5 Real Orders...');
  const sampleCusts = await prisma.customer.findMany({ where: { tenantId: tenant.id, isSample: true } });
  
  // 5 Sample Orders
  for (let i = 0; i < 5; i++) {
    await prisma.order.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        customerId: sampleCusts[i].id,
        orderNumber: `SMP-ORD-${1000 + i}`,
        totalAmount: 2500,
        netAmount: 2500,
        paidAmount: 1000,
        balanceAmount: 1500,
        deliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        status: 'RECEIVED',
        isSample: true
      }
    });
  }

  // 5 Real Orders
  for (let i = 0; i < 5; i++) {
    await prisma.order.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        customerId: realCustomers[i].id,
        orderNumber: `REAL-ORD-${2000 + i}`,
        totalAmount: 4500,
        netAmount: 4500,
        paidAmount: 2000,
        balanceAmount: 2500,
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'RECEIVED',
        isSample: false
      }
    });
  }

  // Verify initial state
  const initSampleCusts = await prisma.customer.count({ where: { tenantId: tenant.id, isSample: true } });
  const initRealCusts = await prisma.customer.count({ where: { tenantId: tenant.id, isSample: false } });
  const initSampleOrders = await prisma.order.count({ where: { tenantId: tenant.id, isSample: true } });
  const initRealOrders = await prisma.order.count({ where: { tenantId: tenant.id, isSample: false } });

  assert.strictEqual(initSampleCusts, 5, 'Initial sample customers count must be 5');
  assert.strictEqual(initRealCusts, 5, 'Initial real customers count must be 5');
  assert.strictEqual(initSampleOrders, 5, 'Initial sample orders count must be 5');
  assert.strictEqual(initRealOrders, 5, 'Initial real orders count must be 5');
  console.log('  ✔ Verified Initial State: 5 sample customers, 5 real customers, 5 sample orders, 5 real orders.');

  console.log('\n[3/4] Executing Clear Sample Data Operation...');
  const clearResult = await SampleDataService.clearSampleShopData(tenant.id);
  console.log('  Clear Result:', clearResult);

  console.log('\n[4/4] Verifying Post-Clear Safety Constraints...');
  const postSampleCusts = await prisma.customer.count({ where: { tenantId: tenant.id, isSample: true } });
  const postRealCusts = await prisma.customer.count({ where: { tenantId: tenant.id, isSample: false } });
  const postSampleOrders = await prisma.order.count({ where: { tenantId: tenant.id, isSample: true } });
  const postRealOrders = await prisma.order.count({ where: { tenantId: tenant.id, isSample: false } });

  console.log(`  Sample Customers Remaining: ${postSampleCusts} (Expected: 0)`);
  console.log(`  Real Customers Remaining:   ${postRealCusts} (Expected: 5)`);
  console.log(`  Sample Orders Remaining:    ${postSampleOrders} (Expected: 0)`);
  console.log(`  Real Orders Remaining:      ${postRealOrders} (Expected: 5)`);

  assert.strictEqual(postSampleCusts, 0, 'Post-clear sample customers must be 0');
  assert.strictEqual(postRealCusts, 5, 'Post-clear real customers must be exactly 5');
  assert.strictEqual(postSampleOrders, 0, 'Post-clear sample orders must be 0');
  assert.strictEqual(postRealOrders, 5, 'Post-clear real orders must be exactly 5');

  console.log('  ✔ PASS: Clear sample data deleted ONLY sample records and preserved ALL real records strictly!');

  // Cleanup test tenant
  await prisma.order.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.customer.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.branch.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.funnelEvent.deleteMany({ where: { shopId: tenant.id } });
  await prisma.tenant.delete({ where: { id: tenant.id } });

  console.log('\n====================================================');
  console.log('  CLEAR SAMPLE DATA SAFETY AUDIT: PASSED (100%)    ');
  console.log('====================================================\n');
}

testClearSampleSafety()
  .catch((err) => {
    console.error('Test Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
