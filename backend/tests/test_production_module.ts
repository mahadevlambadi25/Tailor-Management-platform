import http from 'http';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { config } from '../src/config';
import { prisma } from '../src/core/prisma';
import { OrderStatus, ProductionStageName, RoleType } from '@prisma/client';

async function request(
  baseUrl: string,
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<{ status: number; body: any }> {
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
          resolve({ status: res.statusCode || 500, body: parsed });
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

async function runProductionTests() {
  console.log('================================================================');
  console.log('  PRODUCTION MANAGEMENT MODULE — VERIFICATION & INTEGRATION SUITE');
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

    const owner2 = await prisma.user.findFirst({
      where: { tenantId: tenant2.id, role: RoleType.SHOP_OWNER }
    });
    if (!owner2) throw new Error('Owner 2 not found.');

    // Ensure craftsmen in Tenant 1
    const cutter1 = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant1.id, email: 'cutter1@royal.test' } },
      update: { role: RoleType.CUTTER, isActive: true },
      create: {
        tenantId: tenant1.id,
        name: 'Master Cutter Salim',
        email: 'cutter1@royal.test',
        passwordHash: 'dummy_hash',
        role: RoleType.CUTTER,
        isActive: true
      }
    });

    const tailor1 = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant1.id, email: 'tailor1@royal.test' } },
      update: { role: RoleType.TAILOR, isActive: true },
      create: {
        tenantId: tenant1.id,
        name: 'Senior Tailor Farhan',
        email: 'tailor1@royal.test',
        passwordHash: 'dummy_hash',
        role: RoleType.TAILOR,
        isActive: true
      }
    });

    const finisher1 = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant1.id, email: 'finisher1@royal.test' } },
      update: { role: RoleType.FINISHER, isActive: true },
      create: {
        tenantId: tenant1.id,
        name: 'Finisher Deepa',
        email: 'finisher1@royal.test',
        passwordHash: 'dummy_hash',
        role: RoleType.FINISHER,
        isActive: true
      }
    });

    const receptionist1 = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant1.id, email: 'reception1@royal.test' } },
      update: { role: RoleType.RECEPTIONIST, isActive: true },
      create: {
        tenantId: tenant1.id,
        name: 'Receptionist Anita',
        email: 'reception1@royal.test',
        passwordHash: 'dummy_hash',
        role: RoleType.RECEPTIONIST,
        isActive: true
      }
    });

    // Tenant 2 Craftsman (for cross-tenant testing)
    const tenant2Cutter = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant2.id, email: 'cutter2@elite.test' } },
      update: { role: RoleType.CUTTER, isActive: true },
      create: {
        tenantId: tenant2.id,
        name: 'Elite Cutter Vikram',
        email: 'cutter2@elite.test',
        passwordHash: 'dummy_hash',
        role: RoleType.CUTTER,
        isActive: true
      }
    });

    // Auth Tokens
    const ownerToken = jwt.sign(
      { id: owner1.id, tenantId: tenant1.id, email: owner1.email, role: owner1.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    const cutterToken = jwt.sign(
      { id: cutter1.id, tenantId: tenant1.id, email: cutter1.email, role: cutter1.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    const tailorToken = jwt.sign(
      { id: tailor1.id, tenantId: tenant1.id, email: tailor1.email, role: tailor1.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    const tenant2Token = jwt.sign(
      { id: owner2.id, tenantId: tenant2.id, email: owner2.email, role: owner2.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };
    const cutterHeaders = { Authorization: `Bearer ${cutterToken}` };
    const tailorHeaders = { Authorization: `Bearer ${tailorToken}` };
    const tenant2Headers = { Authorization: `Bearer ${tenant2Token}` };

    // Garment types
    const garments = await prisma.garmentType.findMany({ where: { tenantId: tenant1.id } });
    const shirtGarment = garments.find((g) => g.code === 'SHIRT') || garments[0];
    const pantGarment = garments.find((g) => g.code === 'PANT') || garments[1] || garments[0];

    // Create Dedicated Test Customer
    const testPhone = '9876229988';
    await prisma.customer.deleteMany({ where: { mobile: testPhone } });
    const customer = await prisma.customer.create({
      data: {
        customerId: 'CUST-PROD-TEST',
        tenantId: tenant1.id,
        firstName: 'Devendra',
        lastName: 'Fadnavis',
        mobile: testPhone,
        city: 'Nagpur'
      }
    });

    let multiItemOrderId = '';
    let job1Id = '';
    let job2Id = '';

    // -------------------------------------------------------------
    // Test 1: Production Job Auto-Creation on Multi-Item Order
    // -------------------------------------------------------------
    console.log('[1/14] Testing Production Job Auto-Creation on Order Intake...');
    const orderRes = await request(baseUrl, 'POST', '/orders', ownerHeaders, {
      customerId: customer.id,
      deliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      priority: 'URGENT',
      items: [
        {
          garmentTypeId: shirtGarment.id,
          itemPrice: 2500,
          quantity: 1,
          measurementSnapshot: {
            unit: 'INCHES',
            valuesSnapshot: { Chest: 42, Waist: 36, Shoulder: 19, Length: 30 }
          }
        },
        {
          garmentTypeId: pantGarment.id,
          itemPrice: 3000,
          quantity: 1,
          measurementSnapshot: {
            unit: 'INCHES',
            valuesSnapshot: { Waist: 36, Inseam: 31, Hip: 40 }
          }
        }
      ]
    });

    assert(orderRes.status === 201, 'Order created with HTTP 201');
    multiItemOrderId = orderRes.body.data.id;

    // Verify Jobs created
    const jobs = await prisma.productionJob.findMany({
      where: { tenantId: tenant1.id, orderItem: { orderId: multiItemOrderId } },
      include: { orderItem: { include: { garmentType: true, measurementSnapshot: true } } }
    });

    assert(jobs.length === 2, 'Exactly 2 production jobs auto-created for the 2 items');
    assert(jobs[0].currentStage === ProductionStageName.RECEIVED, 'Initial stage is RECEIVED');
    assert(jobs[1].currentStage === ProductionStageName.RECEIVED, 'Initial stage is RECEIVED');

    job1Id = jobs[0].id;
    job2Id = jobs[1].id;

    // -------------------------------------------------------------
    // Test 2: Production Board Retrieval & Grouping
    // -------------------------------------------------------------
    console.log('[2/14] Testing Production Board Retrieval, Search & Filters...');
    const boardRes = await request(baseUrl, 'GET', '/production/board?search=Devendra', ownerHeaders);
    assert(boardRes.status === 200, 'Board loaded with HTTP 200');
    assert(boardRes.body.success === true, 'Board returned success response');

    const receivedJobs = boardRes.body.data.RECEIVED;
    assert(Array.isArray(receivedJobs), 'RECEIVED stage contains jobs array');
    assert(receivedJobs.some((j: any) => j.id === job1Id), 'Job 1 appears in RECEIVED stage');
    assert(receivedJobs.some((j: any) => j.id === job2Id), 'Job 2 appears in RECEIVED stage');

    // -------------------------------------------------------------
    // Test 3: Multi-Craftsman Staff Assignment
    // -------------------------------------------------------------
    console.log('[3/14] Testing Craftsman Staff Assignment (Cutter, Tailor, Finisher)...');
    const assignRes = await request(baseUrl, 'POST', `/production/jobs/${job1Id}/assign`, ownerHeaders, {
      cutterId: cutter1.id,
      tailorId: tailor1.id,
      finisherId: finisher1.id,
      notes: 'Double French seam styling requested'
    });

    assert(assignRes.status === 200, 'Staff assignment saved with HTTP 200');
    assert(assignRes.body.data.assignments.cutter.name === 'Master Cutter Salim', 'Cutter Salim assigned');
    assert(assignRes.body.data.assignments.tailor.name === 'Senior Tailor Farhan', 'Tailor Farhan assigned');
    assert(assignRes.body.data.assignments.finisher.name === 'Finisher Deepa', 'Finisher Deepa assigned');
    assert(assignRes.body.data.userNotes === 'Double French seam styling requested', 'Notes parsed cleanly');

    // -------------------------------------------------------------
    // Test 4: Wrong-Role Staff Assignment Rejection
    // -------------------------------------------------------------
    console.log('[4/14] Testing Wrong-Role Staff Assignment Rejection...');
    const wrongRoleRes = await request(baseUrl, 'POST', `/production/jobs/${job1Id}/assign`, ownerHeaders, {
      cutterId: receptionist1.id // Assigning Receptionist as Cutter
    });

    assert(wrongRoleRes.status === 400, 'Rejects wrong role with HTTP 400');
    assert(wrongRoleRes.body.error.code === 'INVALID_CRAFT_ROLE', 'Returns error code INVALID_CRAFT_ROLE');

    // -------------------------------------------------------------
    // Test 5: Cross-Tenant Staff Assignment Rejection
    // -------------------------------------------------------------
    console.log('[5/14] Testing Cross-Tenant Staff Assignment Rejection...');
    const crossTenantStaffRes = await request(baseUrl, 'POST', `/production/jobs/${job1Id}/assign`, ownerHeaders, {
      cutterId: tenant2Cutter.id // Tenant 2 cutter assigned to Tenant 1 job
    });

    assert(crossTenantStaffRes.status === 400, 'Rejects cross-tenant staff with HTTP 400');
    assert(crossTenantStaffRes.body.error.code === 'STAFF_NOT_FOUND', 'Returns STAFF_NOT_FOUND');

    // -------------------------------------------------------------
    // Test 6: Canonical Valid Stage Progression
    // -------------------------------------------------------------
    console.log('[6/14] Testing Canonical Valid Stage Progression (RECEIVED -> CUTTING -> STITCHING)...');
    // Move to CUTTING
    const cuttingRes = await request(baseUrl, 'POST', `/production/jobs/${job1Id}/stage`, ownerHeaders, {
      stage: ProductionStageName.CUTTING
    });
    assert(cuttingRes.status === 200, 'Advanced to CUTTING with HTTP 200');
    assert(cuttingRes.body.data.currentStage === ProductionStageName.CUTTING, 'currentStage is CUTTING');
    assert(cuttingRes.body.data.assignedToId === cutter1.id, 'assignedToId automatically synced to assigned Cutter');

    // Move to STITCHING
    const stitchingRes = await request(baseUrl, 'POST', `/production/jobs/${job1Id}/stage`, ownerHeaders, {
      stage: ProductionStageName.STITCHING
    });
    assert(stitchingRes.status === 200, 'Advanced to STITCHING with HTTP 200');
    assert(stitchingRes.body.data.currentStage === ProductionStageName.STITCHING, 'currentStage is STITCHING');
    assert(stitchingRes.body.data.assignedToId === tailor1.id, 'assignedToId automatically synced to assigned Tailor');

    // -------------------------------------------------------------
    // Test 7: Invalid Stage Jump Rejection
    // -------------------------------------------------------------
    console.log('[7/14] Testing Invalid Stage Transition Rejection...');
    // Attempt invalid jump from RECEIVED directly to DELIVERED on Job 2
    const invalidJumpRes = await request(baseUrl, 'POST', `/production/jobs/${job2Id}/stage`, ownerHeaders, {
      stage: ProductionStageName.DELIVERED
    });

    assert(invalidJumpRes.status === 400, 'Rejects invalid jump with HTTP 400');
    assert(invalidJumpRes.body.error.code === 'INVALID_STAGE_TRANSITION', 'Error code is INVALID_STAGE_TRANSITION');

    // -------------------------------------------------------------
    // Test 8: Delay Flagging Validation Gate
    // -------------------------------------------------------------
    console.log('[8/14] Testing Enforced Delay Reason & Revised Date Gate...');
    // Missing delay reason
    const missingReasonRes = await request(baseUrl, 'POST', `/production/jobs/${job1Id}/stage`, ownerHeaders, {
      isDelayed: true
    });
    assert(missingReasonRes.status === 400, 'Missing delay reason rejected with 400');
    assert(missingReasonRes.body.error.code === 'MISSING_DELAY_REASON', 'Returns code MISSING_DELAY_REASON');

    // Valid delay flagging
    const validDelayRes = await request(baseUrl, 'POST', `/production/jobs/${job1Id}/stage`, ownerHeaders, {
      isDelayed: true,
      delayReason: 'Customer requested collar alteration prior to trial',
      revisedDeliveryDate: new Date(Date.now() + 10 * 86400000).toISOString()
    });
    assert(validDelayRes.status === 200, 'Delay flagged with HTTP 200');
    assert(validDelayRes.body.data.isDelayed === true, 'Job marked delayed');
    assert(validDelayRes.body.data.delayReason === 'Customer requested collar alteration prior to trial', 'Delay reason recorded');

    // -------------------------------------------------------------
    // Test 9: Immutable Measurement Snapshot Verification
    // -------------------------------------------------------------
    console.log('[9/14] Testing Immutable Measurement Snapshot Retrieval...');
    const jobDetailsRes = await request(baseUrl, 'GET', `/production/jobs/${job1Id}`, ownerHeaders);
    assert(jobDetailsRes.status === 200, 'Loaded job details with HTTP 200');

    const snapshot = jobDetailsRes.body.data.orderItem.measurementSnapshot;
    assert(!!snapshot, 'Measurement snapshot present on production job item');
    assert(snapshot.valuesSnapshot.Chest === 42, 'Frozen Chest measurement = 42 in');
    assert(snapshot.valuesSnapshot.Waist === 36, 'Frozen Waist measurement = 36 in');

    // -------------------------------------------------------------
    // Test 10: Role-Specific Experience & Task Filtering
    // -------------------------------------------------------------
    console.log('[10/14] Testing Role-Specific Experience (My Tasks filtering)...');
    // Tailor Farhan queries myTasks=true
    const tailorTasksRes = await request(baseUrl, 'GET', '/production/board?myTasks=true', tailorHeaders);
    assert(tailorTasksRes.status === 200, 'Tailor board queries with HTTP 200');

    const tailorJobs = tailorTasksRes.body.data.STITCHING;
    assert(tailorJobs.some((j: any) => j.id === job1Id), 'Job 1 appears in Tailor Farhans assigned queue');

    // -------------------------------------------------------------
    // Test 11: Multi-Item Order Status Synchronization
    // -------------------------------------------------------------
    console.log('[11/14] Testing Multi-Item Order Status Synchronization...');
    // Currently Job 1 is STITCHING, Job 2 is RECEIVED -> Master Order must be IN_PROGRESS
    let orderDb = await prisma.order.findUnique({ where: { id: multiItemOrderId } });
    assert(orderDb?.status === OrderStatus.IN_PROGRESS, 'Order status is IN_PROGRESS during active work');

    // Advance Job 1 to TRIAL
    await request(baseUrl, 'POST', `/production/jobs/${job1Id}/stage`, ownerHeaders, {
      stage: ProductionStageName.TRIAL
    });
    orderDb = await prisma.order.findUnique({ where: { id: multiItemOrderId } });
    assert(orderDb?.status === OrderStatus.TRIAL_PENDING, 'Order status advances to TRIAL_PENDING when item is in TRIAL');

    // Advance Job 1 to READY
    await request(baseUrl, 'POST', `/production/jobs/${job1Id}/stage`, ownerHeaders, {
      stage: ProductionStageName.READY
    });
    // Advance Job 2 from RECEIVED -> CUTTING -> STITCHING -> READY
    await request(baseUrl, 'POST', `/production/jobs/${job2Id}/stage`, ownerHeaders, {
      stage: ProductionStageName.CUTTING
    });
    await request(baseUrl, 'POST', `/production/jobs/${job2Id}/stage`, ownerHeaders, {
      stage: ProductionStageName.STITCHING
    });
    await request(baseUrl, 'POST', `/production/jobs/${job2Id}/stage`, ownerHeaders, {
      stage: ProductionStageName.READY
    });

    // Both items are now READY -> Master order MUST be READY_FOR_PICKUP
    orderDb = await prisma.order.findUnique({ where: { id: multiItemOrderId } });
    assert(orderDb?.status === OrderStatus.READY_FOR_PICKUP, 'Order status becomes READY_FOR_PICKUP when all items are READY');

    // Deliver both items
    await request(baseUrl, 'POST', `/production/jobs/${job1Id}/stage`, ownerHeaders, {
      stage: ProductionStageName.DELIVERED
    });
    await request(baseUrl, 'POST', `/production/jobs/${job2Id}/stage`, ownerHeaders, {
      stage: ProductionStageName.DELIVERED
    });

    // Both items are now DELIVERED -> Master order MUST be DELIVERED
    orderDb = await prisma.order.findUnique({ where: { id: multiItemOrderId } });
    assert(orderDb?.status === OrderStatus.DELIVERED, 'Order status becomes DELIVERED when all items are DELIVERED');

    // -------------------------------------------------------------
    // Test 12: Customer Returned for Alteration Flow (DELIVERED -> ALTERATION)
    // -------------------------------------------------------------
    console.log('[12/14] Testing Explicit "Customer Returned for Alteration" Workflow...');
    // Attempting normal stage update on delivered job must be rejected
    const normalMoveRes = await request(baseUrl, 'POST', `/production/jobs/${job1Id}/stage`, ownerHeaders, {
      stage: ProductionStageName.ALTERATION
    });
    assert(normalMoveRes.status === 400, 'Standard updateStage rejects moving DELIVERED job');
    assert(normalMoveRes.body.error.code === 'USE_RETURN_FOR_ALTERATION', 'Returns USE_RETURN_FOR_ALTERATION code');

    // Missing reason on explicit action
    const missingReturnReason = await request(baseUrl, 'POST', `/production/jobs/${job1Id}/return-for-alteration`, ownerHeaders, {});
    assert(missingReturnReason.status === 400, 'Missing return reason rejected');
    assert(missingReturnReason.body.error.code === 'MISSING_RETURN_REASON', 'Returns MISSING_RETURN_REASON');

    // Valid Return for Alteration
    const validReturnRes = await request(baseUrl, 'POST', `/production/jobs/${job1Id}/return-for-alteration`, ownerHeaders, {
      reason: 'Waist requires 0.5 inch loosening after trial fitting at home',
      notes: 'Urgent weekend function'
    });
    assert(validReturnRes.status === 200, 'Returned for alteration with HTTP 200');
    assert(validReturnRes.body.data.currentStage === ProductionStageName.ALTERATION, 'Job currentStage updated to ALTERATION');

    orderDb = await prisma.order.findUnique({ where: { id: multiItemOrderId } });
    assert(orderDb?.status === OrderStatus.ALTERATION_PENDING, 'Master order status updated to ALTERATION_PENDING');

    // -------------------------------------------------------------
    // Test 13: Strict Multi-Tenant Production Isolation
    // -------------------------------------------------------------
    console.log('[13/14] Testing Strict Multi-Tenant Production Isolation...');
    // Tenant 2 owner queries Tenant 1 job
    const crossTenantGet = await request(baseUrl, 'GET', `/production/jobs/${job1Id}`, tenant2Headers);
    assert(crossTenantGet.status === 404, 'Cross-tenant GET returns 404 (Job completely hidden across tenants)');

    // Tenant 2 owner attempts to advance Tenant 1 job stage
    const crossTenantStage = await request(baseUrl, 'POST', `/production/jobs/${job1Id}/stage`, tenant2Headers, {
      stage: ProductionStageName.READY
    });
    assert(crossTenantStage.status === 404, 'Cross-tenant stage update returns 404');

    // -------------------------------------------------------------
    // Test 14: Comprehensive Production Audit Trail
    // -------------------------------------------------------------
    console.log('[14/14] Testing Comprehensive Production Audit Trail...');
    const auditLogs = await prisma.auditLog.findMany({
      where: { tenantId: tenant1.id, entity: 'ProductionJob', entityId: job1Id }
    });

    const actions = auditLogs.map((l) => l.action);
    assert(actions.includes('PRODUCTION_STAFF_ASSIGNED'), 'Audit log contains PRODUCTION_STAFF_ASSIGNED');
    assert(actions.includes('PRODUCTION_STAGE_UPDATED'), 'Audit log contains PRODUCTION_STAGE_UPDATED');
    assert(actions.includes('JOB_RETURNED_FOR_ALTERATION'), 'Audit log contains JOB_RETURNED_FOR_ALTERATION');

    // -------------------------------------------------------------
    // Cleanup Test Data
    // -------------------------------------------------------------
    await prisma.auditLog.deleteMany({ where: { tenantId: tenant1.id, entity: 'ProductionJob' } });
    await prisma.productionStageHistory.deleteMany({ where: { tenantId: tenant1.id } });
    await prisma.productionJob.deleteMany({ where: { tenantId: tenant1.id } });
    await prisma.orderItemMeasurement.deleteMany({ where: { tenantId: tenant1.id } });
    await prisma.orderItem.deleteMany({ where: { tenantId: tenant1.id } });
    await prisma.payment.deleteMany({ where: { tenantId: tenant1.id } });
    await prisma.receipt.deleteMany({ where: { tenantId: tenant1.id } });
    await prisma.order.deleteMany({ where: { tenantId: tenant1.id } });
    await prisma.customer.deleteMany({ where: { mobile: testPhone } });

    console.log('\n  ✔ Production test data cleaned up successfully.');

    console.log('\n================================================================');
    console.log(`  PRODUCTION TESTS FINISHED: ${passed} PASSED | ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runProductionTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ PRODUCTION TEST FAILED:\n', err);
    process.exit(1);
  });
