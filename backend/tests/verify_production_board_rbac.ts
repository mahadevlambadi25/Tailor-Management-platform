import { prisma } from '../src/core/prisma';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';
import { ProductionStageName, RoleType } from '@prisma/client';

async function runProductionRbacVerification() {
  console.log('================================================================');
  console.log('  PRODUCTION BOARD RBAC & TENANT ISOLATION VERIFICATION SUITE   ');
  console.log('================================================================\n');

  const BASE_URL = 'http://localhost:5000/api/v1';
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

  // 1. Setup Tenants and Test Users
  const tenant1 = await prisma.tenant.findUnique({ where: { slug: 'royal-bespoke' } });
  if (!tenant1) throw new Error('Tenant 1 (royal-bespoke) not found');
  const tenant2 = await prisma.tenant.findUnique({ where: { slug: 'elite-stitching' } });
  if (!tenant2) throw new Error('Tenant 2 (elite-stitching) not found');

  const owner = await prisma.user.findFirst({ where: { tenantId: tenant1.id, role: RoleType.SHOP_OWNER } });
  if (!owner) throw new Error('Owner not found in Tenant 1');

  const manager = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant1.id, email: 'manager@royalbespoke.com' } },
    update: { role: RoleType.MANAGER, isActive: true },
    create: {
      tenantId: tenant1.id,
      name: 'Workshop Manager',
      email: 'manager@royalbespoke.com',
      passwordHash: 'dummy',
      role: RoleType.MANAGER,
      isActive: true
    }
  });

  const cutter = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant1.id, email: 'cutter@royalbespoke.com' } },
    update: { role: RoleType.CUTTER, isActive: true },
    create: {
      tenantId: tenant1.id,
      name: 'Master Cutter',
      email: 'cutter@royalbespoke.com',
      passwordHash: 'dummy',
      role: RoleType.CUTTER,
      isActive: true
    }
  });

  const tailor = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant1.id, email: 'tailor@royalbespoke.com' } },
    update: { role: RoleType.TAILOR, isActive: true },
    create: {
      tenantId: tenant1.id,
      name: 'Master Tailor',
      email: 'tailor@royalbespoke.com',
      passwordHash: 'dummy',
      role: RoleType.TAILOR,
      isActive: true
    }
  });

  const finisher = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant1.id, email: 'finisher@royalbespoke.com' } },
    update: { role: RoleType.FINISHER, isActive: true },
    create: {
      tenantId: tenant1.id,
      name: 'Quality Finisher',
      email: 'finisher@royalbespoke.com',
      passwordHash: 'dummy',
      role: RoleType.FINISHER,
      isActive: true
    }
  });

  const receptionist = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant1.id, email: 'receptionist@royalbespoke.com' } },
    update: { role: RoleType.RECEPTIONIST, isActive: true },
    create: {
      tenantId: tenant1.id,
      name: 'Front Desk Receptionist',
      email: 'receptionist@royalbespoke.com',
      passwordHash: 'dummy',
      role: RoleType.RECEPTIONIST,
      isActive: true
    }
  });

  const cashier = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant1.id, email: 'cashier@royalbespoke.com' } },
    update: { role: RoleType.CASHIER, isActive: true },
    create: {
      tenantId: tenant1.id,
      name: 'Billing Cashier',
      email: 'cashier@royalbespoke.com',
      passwordHash: 'dummy',
      role: RoleType.CASHIER,
      isActive: true
    }
  });

  const customerUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant1.id, email: 'client@royalbespoke.com' } },
    update: { role: RoleType.CUSTOMER, isActive: true },
    create: {
      tenantId: tenant1.id,
      name: 'Portal Customer',
      email: 'client@royalbespoke.com',
      passwordHash: 'dummy',
      role: RoleType.CUSTOMER,
      isActive: true
    }
  });

  const owner2 = await prisma.user.findFirst({ where: { tenantId: tenant2.id, role: RoleType.SHOP_OWNER } });
  if (!owner2) throw new Error('Owner not found in Tenant 2');

  function makeHeaders(u: { id: string; tenantId: string; email: string; role: RoleType }) {
    const token = jwt.sign(
      { id: u.id, tenantId: u.tenantId, email: u.email, role: u.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  const ownerHeaders = makeHeaders(owner);
  const managerHeaders = makeHeaders(manager);
  const cutterHeaders = makeHeaders(cutter);
  const tailorHeaders = makeHeaders(tailor);
  const finisherHeaders = makeHeaders(finisher);
  const receptionistHeaders = makeHeaders(receptionist);
  const cashierHeaders = makeHeaders(cashier);
  const customerHeaders = makeHeaders(customerUser);
  const tenant2Headers = makeHeaders(owner2);

  // Dedicated Test Customer
  let testCustomer = await prisma.customer.findFirst({
    where: { tenantId: tenant1.id, mobile: '9988776655' }
  });
  if (!testCustomer) {
    testCustomer = await prisma.customer.create({
      data: {
        tenantId: tenant1.id,
        customerId: 'CUST-RBAC-001',
        firstName: 'Rohan',
        lastName: 'Sharma',
        mobile: '9988776655'
      }
    });
  }

  const garments = await prisma.garmentType.findMany({ where: { tenantId: tenant1.id, isActive: true } });
  if (garments.length < 2) throw new Error('Need at least 2 active garment types in Tenant 1');

  // Create order via API to trigger automatic production job generation
  const createOrderRes = await fetch(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({
      customerId: testCustomer.id,
      deliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      priority: 'REGULAR',
      items: [
        {
          garmentTypeId: garments[0].id,
          itemPrice: 3000,
          quantity: 1,
          measurementValues: { Chest: 40, Waist: 34 }
        },
        {
          garmentTypeId: garments[1].id,
          itemPrice: 3500,
          quantity: 1,
          measurementValues: { Chest: 42, Waist: 36 }
        }
      ]
    })
  });
  const orderData: any = await createOrderRes.json();
  if (!orderData.success) {
    throw new Error('Failed to create test order: ' + JSON.stringify(orderData));
  }
  const orderId = orderData.data.id;

  // Retrieve auto-generated production jobs
  const jobs = await prisma.productionJob.findMany({
    where: { tenantId: tenant1.id, orderItem: { orderId } }
  });
  if (jobs.length < 2) throw new Error('Failed to auto-create production jobs');

  const job1Id = jobs[0].id;
  const job2Id = jobs[1].id;

  // Assign staff to Job 1 (Cutter, Tailor, Finisher)
  await fetch(`${BASE_URL}/production/jobs/${job1Id}/assign`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({
      cutterId: cutter.id,
      tailorId: tailor.id,
      finisherId: finisher.id,
      notes: 'Custom stitch request'
    })
  });

  // Assign staff to Job 2
  await fetch(`${BASE_URL}/production/jobs/${job2Id}/assign`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({
      cutterId: cutter.id,
      tailorId: tailor.id,
      finisherId: finisher.id,
      notes: 'Second item'
    })
  });

  // Advance Job 1 from RECEIVED -> CUTTING -> STITCHING
  await fetch(`${BASE_URL}/production/jobs/${job1Id}/stage`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({ stage: ProductionStageName.CUTTING })
  });
  await fetch(`${BASE_URL}/production/jobs/${job1Id}/stage`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({ stage: ProductionStageName.STITCHING })
  });

  // Advance Job 2 from RECEIVED -> CUTTING
  await fetch(`${BASE_URL}/production/jobs/${job2Id}/stage`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({ stage: ProductionStageName.CUTTING })
  });

  try {
    // -------------------------------------------------------------
    // Scenario 1: SHOP_OWNER -> Full Production Board Access
    // -------------------------------------------------------------
    console.log('[1/9] Testing SHOP_OWNER Production Board Permissions...');
    const ownerBoardRes = await fetch(`${BASE_URL}/production/board`, { headers: ownerHeaders });
    const ownerBoard: any = await ownerBoardRes.json();
    assert(ownerBoard.success === true, 'SHOP_OWNER accesses production board (HTTP 200)');
    assert(!!ownerBoard.data.CUTTING && !!ownerBoard.data.STITCHING, 
      'SHOP_OWNER receives full multi-stage board overview');
    
    // Owner can view users list
    const ownerUsers = await fetch(`${BASE_URL}/users`, { headers: ownerHeaders });
    assert(ownerUsers.status === 200, 'SHOP_OWNER has users:view / user listing access');

    // Owner can assign staff
    const ownerAssign = await fetch(`${BASE_URL}/production/jobs/${job1Id}/assign`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ tailorId: tailor.id })
    });
    assert(ownerAssign.status === 200, 'SHOP_OWNER can assign workshop staff');

    // -------------------------------------------------------------
    // Scenario 2: MANAGER -> Full Production Board Access
    // -------------------------------------------------------------
    console.log('\n[2/9] Testing MANAGER Production Board Permissions...');
    const managerBoardRes = await fetch(`${BASE_URL}/production/board`, { headers: managerHeaders });
    const managerBoard: any = await managerBoardRes.json();
    assert(managerBoard.success === true, 'MANAGER accesses production board (HTTP 200)');
    assert(!!managerBoard.data.CUTTING && !!managerBoard.data.STITCHING, 
      'MANAGER receives full multi-stage board overview');

    // Manager can view users list
    const managerUsers = await fetch(`${BASE_URL}/users`, { headers: managerHeaders });
    assert(managerUsers.status === 200, 'MANAGER has users:view / user listing access');

    // Manager can assign staff
    const managerAssign = await fetch(`${BASE_URL}/production/jobs/${job1Id}/assign`, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({ tailorId: tailor.id })
    });
    assert(managerAssign.status === 200, 'MANAGER can assign workshop staff');

    // -------------------------------------------------------------
    // Scenario 3: CUTTER -> Cutting/Assigned Work Scoped Access
    // -------------------------------------------------------------
    console.log('\n[3/9] Testing CUTTER Production Board Permissions & Scoping...');
    const cutterBoardRes = await fetch(`${BASE_URL}/production/board`, { headers: cutterHeaders });
    const cutterBoard: any = await cutterBoardRes.json();
    assert(cutterBoard.success === true, 'CUTTER accesses production board (HTTP 200)');
    assert(cutterBoard.data.CUTTING.length > 0, 'CUTTER sees relevant CUTTING jobs');
    assert(cutterBoard.data.RECEIVED.length === 0, 'CUTTER is scoped out of unassigned RECEIVED queue');

    // CUTTER cannot list users
    const cutterUsers = await fetch(`${BASE_URL}/users`, { headers: cutterHeaders });
    assert(cutterUsers.status === 403, 'CUTTER blocked from GET /users (no user admin access)');

    // CUTTER cannot assign staff
    const cutterAssign = await fetch(`${BASE_URL}/production/jobs/${job2Id}/assign`, {
      method: 'POST',
      headers: cutterHeaders,
      body: JSON.stringify({ cutterId: cutter.id })
    });
    assert(cutterAssign.status === 403, 'CUTTER blocked from POST /assign (cannot manage staff assignments)');

    // CUTTER can advance CUTTING -> STITCHING
    const cutterAdvance = await fetch(`${BASE_URL}/production/jobs/${job2Id}/stage`, {
      method: 'POST',
      headers: cutterHeaders,
      body: JSON.stringify({ stage: ProductionStageName.STITCHING })
    });
    assert(cutterAdvance.status === 200, 'CUTTER can advance stage from CUTTING to STITCHING');

    // CUTTER cannot advance STITCHING stage
    const cutterAdvanceStitching = await fetch(`${BASE_URL}/production/jobs/${job1Id}/stage`, {
      method: 'POST',
      headers: cutterHeaders,
      body: JSON.stringify({ stage: ProductionStageName.FINISHING })
    });
    assert(cutterAdvanceStitching.status === 403, 'CUTTER blocked from advancing STITCHING stage (role-restricted)');

    // -------------------------------------------------------------
    // Scenario 4: TAILOR -> Stitching/Assigned Work Scoped Access
    // -------------------------------------------------------------
    console.log('\n[4/9] Testing TAILOR Production Board Permissions & Scoping...');
    const tailorBoardRes = await fetch(`${BASE_URL}/production/board`, { headers: tailorHeaders });
    const tailorBoard: any = await tailorBoardRes.json();
    assert(tailorBoard.success === true, 'TAILOR accesses production board (HTTP 200) - NO 403 on board load');
    assert(tailorBoard.data.STITCHING.length > 0, 'TAILOR sees relevant STITCHING queue');
    assert(tailorBoard.data.RECEIVED.length === 0, 'TAILOR is scoped out of unassigned RECEIVED queue');

    // TAILOR cannot list users
    const tailorUsers = await fetch(`${BASE_URL}/users`, { headers: tailorHeaders });
    assert(tailorUsers.status === 403, 'TAILOR blocked from GET /users (RBAC enforced)');

    // TAILOR cannot assign staff
    const tailorAssign = await fetch(`${BASE_URL}/production/jobs/${job1Id}/assign`, {
      method: 'POST',
      headers: tailorHeaders,
      body: JSON.stringify({ tailorId: tailor.id })
    });
    assert(tailorAssign.status === 403, 'TAILOR blocked from POST /assign (no manager permissions)');

    // TAILOR can advance STITCHING -> FINISHING
    const tailorAdvance = await fetch(`${BASE_URL}/production/jobs/${job1Id}/stage`, {
      method: 'POST',
      headers: tailorHeaders,
      body: JSON.stringify({ stage: ProductionStageName.FINISHING })
    });
    assert(tailorAdvance.status === 200, 'TAILOR can advance STITCHING to FINISHING');

    // Advance Job 1 from FINISHING to READY via management
    await fetch(`${BASE_URL}/production/jobs/${job1Id}/stage`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ stage: ProductionStageName.READY })
    });

    // TAILOR cannot deliver garments
    const tailorDeliver = await fetch(`${BASE_URL}/production/jobs/${job1Id}/stage`, {
      method: 'POST',
      headers: tailorHeaders,
      body: JSON.stringify({ stage: ProductionStageName.DELIVERED })
    });
    assert(tailorDeliver.status === 403, 'TAILOR blocked from marking job DELIVERED (counter/management only)');

    // -------------------------------------------------------------
    // Scenario 5: FINISHER -> Finishing/Assigned Work Scoped Access
    // -------------------------------------------------------------
    console.log('\n[5/9] Testing FINISHER Production Board Permissions & Scoping...');
    // Advance Job 2 (currently in STITCHING) to FINISHING
    await fetch(`${BASE_URL}/production/jobs/${job2Id}/stage`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ stage: ProductionStageName.FINISHING })
    });

    const finisherBoardRes = await fetch(`${BASE_URL}/production/board`, { headers: finisherHeaders });
    const finisherBoard: any = await finisherBoardRes.json();
    assert(finisherBoard.success === true, 'FINISHER accesses production board (HTTP 200)');
    assert(finisherBoard.data.FINISHING.length > 0, 'FINISHER sees relevant FINISHING queue');
    assert(finisherBoard.data.RECEIVED.length === 0, 'FINISHER is scoped out of unassigned RECEIVED queue');

    // FINISHER cannot list users
    const finisherUsers = await fetch(`${BASE_URL}/users`, { headers: finisherHeaders });
    assert(finisherUsers.status === 403, 'FINISHER blocked from GET /users');

    // FINISHER cannot assign staff
    const finisherAssign = await fetch(`${BASE_URL}/production/jobs/${job2Id}/assign`, {
      method: 'POST',
      headers: finisherHeaders,
      body: JSON.stringify({ finisherId: finisher.id })
    });
    assert(finisherAssign.status === 403, 'FINISHER blocked from POST /assign');

    // FINISHER can advance FINISHING -> READY
    const finisherAdvance = await fetch(`${BASE_URL}/production/jobs/${job2Id}/stage`, {
      method: 'POST',
      headers: finisherHeaders,
      body: JSON.stringify({ stage: ProductionStageName.READY })
    });
    assert(finisherAdvance.status === 200, 'FINISHER can advance FINISHING to READY');

    // -------------------------------------------------------------
    // Scenario 6: RECEPTIONIST -> Follow Existing Permission Model
    // -------------------------------------------------------------
    console.log('\n[6/9] Testing RECEPTIONIST Existing Intended Behavior...');
    // Receptionist has read access to board to check status
    const recBoard = await fetch(`${BASE_URL}/production/board`, { headers: receptionistHeaders });
    assert(recBoard.status === 200, 'RECEPTIONIST can view production board for order status lookup');

    // Receptionist CANNOT advance production stages
    const recStage = await fetch(`${BASE_URL}/production/jobs/${job1Id}/stage`, {
      method: 'POST',
      headers: receptionistHeaders,
      body: JSON.stringify({ stage: ProductionStageName.READY })
    });
    assert(recStage.status === 403, 'RECEPTIONIST blocked from stage advancement (HTTP 403 FORBIDDEN_ROLE)');

    // Receptionist CANNOT assign workshop staff
    const recAssign = await fetch(`${BASE_URL}/production/jobs/${job1Id}/assign`, {
      method: 'POST',
      headers: receptionistHeaders,
      body: JSON.stringify({ tailorId: tailor.id })
    });
    assert(recAssign.status === 403, 'RECEPTIONIST blocked from staff assignment (HTTP 403 FORBIDDEN_ROLE)');

    // -------------------------------------------------------------
    // Scenario 7: CASHIER -> Verify Intended Behavior
    // -------------------------------------------------------------
    console.log('\n[7/9] Testing CASHIER Production Board Access...');
    const cashierBoard = await fetch(`${BASE_URL}/production/board`, { headers: cashierHeaders });
    assert(cashierBoard.status === 403, 'CASHIER blocked from Production Board (HTTP 403 Forbidden)');

    const cashierStage = await fetch(`${BASE_URL}/production/jobs/${job1Id}/stage`, {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({ stage: ProductionStageName.READY })
    });
    assert(cashierStage.status === 403, 'CASHIER blocked from stage advancement (HTTP 403 Forbidden)');

    // -------------------------------------------------------------
    // Scenario 8: CUSTOMER -> Strictly Blocked
    // -------------------------------------------------------------
    console.log('\n[8/9] Testing CUSTOMER Production Board Blockade...');
    const customerBoard = await fetch(`${BASE_URL}/production/board`, { headers: customerHeaders });
    assert(customerBoard.status === 403, 'CUSTOMER blocked from Production Board (HTTP 403 Forbidden)');

    const customerStage = await fetch(`${BASE_URL}/production/jobs/${job1Id}/stage`, {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({ stage: ProductionStageName.READY })
    });
    assert(customerStage.status === 403, 'CUSTOMER blocked from stage updates (HTTP 403 Forbidden)');

    // -------------------------------------------------------------
    // Scenario 9: Cross-Tenant Production Data Isolation
    // -------------------------------------------------------------
    console.log('\n[9/9] Testing Cross-Tenant Production Data Isolation...');
    // Tenant 2 owner queries Tenant 1 job
    const crossTenantGet = await fetch(`${BASE_URL}/production/jobs/${job1Id}`, {
      headers: tenant2Headers
    });
    assert(crossTenantGet.status === 404, 'Cross-tenant job details query returns 404 (strictly hidden across tenants)');

    // Tenant 2 owner queries board
    const crossTenantBoardRes = await fetch(`${BASE_URL}/production/board`, { headers: tenant2Headers });
    const crossTenantBoard: any = await crossTenantBoardRes.json();
    const allTenant2Jobs: any[] = Object.values(crossTenantBoard.data || {}).flat() as any[];
    const hasTenant1Job = allTenant2Jobs.some((j: any) => j.id === job1Id || j.id === job2Id);
    assert(!hasTenant1Job, 'Tenant 2 board query NEVER contains Tenant 1 production jobs (Zero cross-tenant leak)');

    // Tenant 2 owner attempts stage update on Tenant 1 job
    const crossTenantStage = await fetch(`${BASE_URL}/production/jobs/${job1Id}/stage`, {
      method: 'POST',
      headers: tenant2Headers,
      body: JSON.stringify({ stage: ProductionStageName.READY })
    });
    assert(crossTenantStage.status === 404, 'Cross-tenant stage update returns 404');

  } finally {
    // Cleanup test data
    await prisma.auditLog.deleteMany({ where: { tenantId: tenant1.id, entity: 'ProductionJob' } });
    await prisma.productionStageHistory.deleteMany({ where: { tenantId: tenant1.id } });
    await prisma.productionJob.deleteMany({ where: { tenantId: tenant1.id, orderItem: { orderId } } });
    await prisma.orderItem.deleteMany({ where: { tenantId: tenant1.id, orderId } });
    await prisma.order.deleteMany({ where: { id: orderId } });
    if (testCustomer) {
      await prisma.customer.deleteMany({ where: { id: testCustomer.id } });
    }
  }

  console.log('\n================================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runProductionRbacVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ VERIFICATION SUITE FAILED:\n', err);
    process.exit(1);
  });
