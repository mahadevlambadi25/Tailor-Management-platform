import { prisma } from '../src/core/prisma';
import bcrypt from 'bcryptjs';
import { subscriptionService } from '../src/modules/subscriptions/subscriptionService';
import { purgeTenantDemoData, seedDemoDataForTenant } from '../src/modules/demo/demoService';
import { SubscriptionStatus, RoleType, OrderStatus } from '@prisma/client';

const API_BASE = 'http://localhost:5000/api/v1';

async function runTrialEnforcementAndPurgeTests() {
  console.log('================================================================');
  console.log('   14-DAY FREE TRIAL & ONE-TIME ENFORCEMENT TEST SUITE          ');
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

  const TENANT_1_SLUG = 'trial-enforce-atelier-1';
  const TENANT_2_SLUG = 'trial-enforce-atelier-2';
  let tenant1: any = null;
  let tenant2: any = null;
  let token1 = '';
  let token2 = '';

  try {
    // -------------------------------------------------------------------------
    // Setup Test Tenants and Users
    // -------------------------------------------------------------------------
    console.log('[Setup] Preparing isolated test tenants...');

    // Cleanup prior test runs
    for (const slug of [TENANT_1_SLUG, TENANT_2_SLUG]) {
      const existing = await prisma.tenant.findUnique({ where: { slug } });
      if (existing) {
        await purgeTenantDemoData(existing.id);
        await prisma.auditLog.deleteMany({ where: { tenantId: existing.id } });
        await prisma.orderItem.deleteMany({ where: { order: { tenantId: existing.id } } });
        await prisma.order.deleteMany({ where: { tenantId: existing.id } });
        await prisma.customer.deleteMany({ where: { tenantId: existing.id } });
        await prisma.user.deleteMany({ where: { tenantId: existing.id } });
        await prisma.subscription.deleteMany({ where: { tenantId: existing.id } });
        await prisma.tenant.delete({ where: { id: existing.id } });
      }
    }

    // Create Tenant 1 (Brand new tenant, trial NOT yet used)
    tenant1 = await prisma.tenant.create({
      data: {
        name: 'Trial Atelier Prime',
        slug: TENANT_1_SLUG,
        phone: '9888811111',
        email: 'trial1@atelier.com',
        currency: 'INR',
        defaultUnit: 'INCHES'
      }
    });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Password123!', salt);

    await prisma.user.create({
      data: {
        tenantId: tenant1.id,
        name: 'Owner Prime',
        email: 'owner1@atelier.com',
        passwordHash,
        role: RoleType.SHOP_OWNER,
        isActive: true
      }
    });

    // Create Tenant 2 (Isolation comparison tenant)
    tenant2 = await prisma.tenant.create({
      data: {
        name: 'Trial Atelier Secundus',
        slug: TENANT_2_SLUG,
        phone: '9888822222',
        email: 'trial2@atelier.com',
        currency: 'INR',
        defaultUnit: 'INCHES'
      }
    });

    await prisma.user.create({
      data: {
        tenantId: tenant2.id,
        name: 'Owner Secundus',
        email: 'owner2@atelier.com',
        passwordHash,
        role: RoleType.SHOP_OWNER,
        isActive: true
      }
    });

    // Login Tenant 1
    const loginRes1 = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner1@atelier.com', password: 'Password123!', tenantSlug: TENANT_1_SLUG })
    });
    const loginData1: any = await loginRes1.json();
    token1 = loginData1.data?.token;

    // Login Tenant 2
    const loginRes2 = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner2@atelier.com', password: 'Password123!', tenantSlug: TENANT_2_SLUG })
    });
    const loginData2: any = await loginRes2.json();
    token2 = loginData2.data?.token;

    assert(!!token1 && !!token2, 'Authentication tokens acquired for both test tenants');

    // -------------------------------------------------------------------------
    // Scenario 0: Initial Tenant State (trialUsed = false)
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 0] Initial state before starting trial...');
    // Initialize initial pending subscription
    await subscriptionService.createInitialSubscription(tenant1.id);
    const initialSub = await prisma.subscription.findUnique({ where: { tenantId: tenant1.id } });
    assert(initialSub !== null, 'Initial subscription record exists');
    assert(initialSub?.trialUsed === false, 'Initial subscription has trialUsed=false');
    assert(initialSub?.status === SubscriptionStatus.PENDING, 'Initial subscription status is PENDING');

    const isEligible = await subscriptionService.isTrialEligible(tenant1.id);
    assert(isEligible === true, 'New tenant is trial eligible');

    // -------------------------------------------------------------------------
    // Scenario 8 & 9: Seed Demo Data and Real Data before trial activation
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 8 & 9] Seeding demo and real records prior to trial activation...');
    await seedDemoDataForTenant(tenant1.id);

    // Create a real customer and real order for Tenant 1
    const realCustomer = await prisma.customer.create({
      data: {
        tenantId: tenant1.id,
        customerId: 'CUST-REAL-001',
        firstName: 'Maharani',
        lastName: 'Devi',
        mobile: '9999900001',
        isDemo: false
      }
    });

    const realOrder = await prisma.order.create({
      data: {
        tenantId: tenant1.id,
        customerId: realCustomer.id,
        orderNumber: 'REAL-ORD-001',
        status: OrderStatus.RECEIVED,
        totalAmount: 12000,
        netAmount: 12000,
        paidAmount: 6000,
        balanceAmount: 6000,
        deliveryDate: new Date(Date.now() + 7 * 86400000),
        isDemo: false
      }
    });

    const demoCustomersBefore = await prisma.customer.count({ where: { tenantId: tenant1.id, isDemo: true } });
    const demoOrdersBefore = await prisma.order.count({ where: { tenantId: tenant1.id, isDemo: true } });
    assert(demoCustomersBefore > 0, `Demo customers seeded: ${demoCustomersBefore}`);
    assert(demoOrdersBefore > 0, `Demo orders seeded: ${demoOrdersBefore}`);

    // -------------------------------------------------------------------------
    // Scenario 1, 2, 3: Starting 14-Day Free Trial
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 1, 2, 3] Starting 14-day free trial via API...');
    const startRes = await fetch(`${API_BASE}/subscriptions/start-trial`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`
      }
    });
    const startJson: any = await startRes.json();
    assert(startRes.status === 200, 'POST /subscriptions/start-trial returns HTTP 200');
    assert(startJson.success === true, 'Response success is true');

    const subAfterStart = await prisma.subscription.findUnique({ where: { tenantId: tenant1.id } });
    assert(subAfterStart?.status === SubscriptionStatus.TRIAL, 'Subscription status transitioned to TRIAL');
    assert(subAfterStart?.planName === 'FREE_TRIAL', 'Plan name is FREE_TRIAL');
    assert(subAfterStart?.trialUsed === true, 'Starting trial marks trialUsed=true');
    assert(!!subAfterStart?.trialStart && !!subAfterStart?.trialEnd, 'trialStart and trialEnd are populated');

    // Scenario 2: Trial duration is exactly 14 days
    const trialStartMs = new Date(subAfterStart!.trialStart!).getTime();
    const trialEndMs = new Date(subAfterStart!.trialEnd!).getTime();
    const diffDays = Math.round((trialEndMs - trialStartMs) / (1000 * 60 * 60 * 24));
    assert(diffDays === 14, `Trial duration is exactly 14 days (actual: ${diffDays})`);

    // Scenario 8: Starting trial purges demo data
    const demoCustomersAfter = await prisma.customer.count({ where: { tenantId: tenant1.id, isDemo: true } });
    const demoOrdersAfter = await prisma.order.count({ where: { tenantId: tenant1.id, isDemo: true } });
    assert(demoCustomersAfter === 0, 'All demo customers purged upon trial start (0 remaining)');
    assert(demoOrdersAfter === 0, 'All demo orders purged upon trial start (0 remaining)');

    // Scenario 9: Real customer and order remain untouched
    const realCustomerCheck = await prisma.customer.findUnique({ where: { id: realCustomer.id } });
    const realOrderCheck = await prisma.order.findUnique({ where: { id: realOrder.id } });
    assert(realCustomerCheck !== null, 'Real customer strictly preserved');
    assert(realOrderCheck !== null, 'Real order strictly preserved');
    assert(realCustomerCheck?.firstName === 'Maharani', 'Real customer data intact');

    // -------------------------------------------------------------------------
    // Scenario 10: Demo Purge Idempotency
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 10] Testing demo purge idempotency...');
    const secondPurge = await purgeTenantDemoData(tenant1.id);
    assert(secondPurge.deletedOrdersCount === 0, 'Idempotent second purge deletes 0 orders');
    assert(secondPurge.deletedCustomersCount === 0, 'Idempotent second purge deletes 0 customers');
    const realCustomerStillThere = await prisma.customer.findUnique({ where: { id: realCustomer.id } });
    assert(realCustomerStillThere !== null, 'Real customer still safe after second purge');

    // -------------------------------------------------------------------------
    // Scenario 4: Second trial attempt while TRIAL is active is rejected
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 4] Attempting second trial activation while in TRIAL...');
    function isTrialAlreadyUsedError(json: any) {
      return (
        json?.error === 'TRIAL_ALREADY_USED' ||
        json?.code === 'TRIAL_ALREADY_USED' ||
        json?.error?.code === 'TRIAL_ALREADY_USED' ||
        json?.message === 'TRIAL_ALREADY_USED'
      );
    }

    const secondTrialRes = await fetch(`${API_BASE}/subscriptions/start-trial`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`
      }
    });
    const secondTrialJson: any = await secondTrialRes.json();
    assert(secondTrialRes.status === 400, 'Second trial attempt returns HTTP 400');
    assert(
      isTrialAlreadyUsedError(secondTrialJson),
      `Error indicates TRIAL_ALREADY_USED (actual: ${JSON.stringify(secondTrialJson)})`
    );

    // -------------------------------------------------------------------------
    // Scenario 5: Expired tenant cannot start another trial
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 5] Expired tenant cannot start another trial...');
    // Manually set subscription to expired past trial
    await prisma.subscription.update({
      where: { tenantId: tenant1.id },
      data: {
        status: SubscriptionStatus.EXPIRED,
        trialEnd: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    });

    const expiredTrialRes = await fetch(`${API_BASE}/subscriptions/start-trial`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`
      }
    });
    const expiredTrialJson: any = await expiredTrialRes.json();
    assert(expiredTrialRes.status === 400, 'Expired tenant rejected with HTTP 400');
    assert(
      isTrialAlreadyUsedError(expiredTrialJson),
      'Expired tenant rejected with TRIAL_ALREADY_USED'
    );

    // Check trialUsed remains true
    const expiredSub = await prisma.subscription.findUnique({ where: { tenantId: tenant1.id } });
    assert(expiredSub?.trialUsed === true, 'trialUsed remains true on expired tenant');

    // -------------------------------------------------------------------------
    // Scenario 6: Cancelled tenant cannot start another trial
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 6] Cancelled tenant cannot start another trial...');
    await prisma.subscription.update({
      where: { tenantId: tenant1.id },
      data: { status: SubscriptionStatus.CANCELLED }
    });

    const cancelledTrialRes = await fetch(`${API_BASE}/subscriptions/start-trial`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`
      }
    });
    const cancelledTrialJson: any = await cancelledTrialRes.json();
    assert(cancelledTrialRes.status === 400, 'Cancelled tenant rejected with HTTP 400');
    assert(
      isTrialAlreadyUsedError(cancelledTrialJson),
      'Cancelled tenant rejected with TRIAL_ALREADY_USED'
    );

    // -------------------------------------------------------------------------
    // Scenario 7: Past-due tenant cannot start another trial
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 7] Past-due tenant cannot start another trial...');
    await prisma.subscription.update({
      where: { tenantId: tenant1.id },
      data: { status: SubscriptionStatus.PAST_DUE }
    });

    const pastDueTrialRes = await fetch(`${API_BASE}/subscriptions/start-trial`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`
      }
    });
    const pastDueTrialJson: any = await pastDueTrialRes.json();
    assert(pastDueTrialRes.status === 400, 'Past-due tenant rejected with HTTP 400');
    assert(
      isTrialAlreadyUsedError(pastDueTrialJson),
      'Past-due tenant rejected with TRIAL_ALREADY_USED'
    );

    // -------------------------------------------------------------------------
    // Scenario 11: Demo data does not return after trial expiration
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 11] Demo data does not automatically regenerate after expiration...');
    // Trigger subscription status resolution
    await subscriptionService.checkSubscriptionStatus(tenant1.id);
    const demoCustomersPostExpiry = await prisma.customer.count({ where: { tenantId: tenant1.id, isDemo: true } });
    const demoOrdersPostExpiry = await prisma.order.count({ where: { tenantId: tenant1.id, isDemo: true } });
    assert(demoCustomersPostExpiry === 0, 'No demo customers regenerated after expiration');
    assert(demoOrdersPostExpiry === 0, 'No demo orders regenerated after expiration');

    // -------------------------------------------------------------------------
    // Scenario 12: Subscription UI States Classification Logic
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 12] Subscription UI states classification logic verification...');

    function classifyState(sub: any) {
      const trialUsed = sub?.trialUsed === true;
      const isPaidPlan = !!sub?.planName && sub.planName !== 'FREE_TRIAL';
      const isSubscriptionActive = sub?.status === 'ACTIVE' || (
        sub?.status === 'TRIAL' && (!sub?.trialEnd || new Date(sub.trialEnd).getTime() > Date.now())
      );
      const isSubscriptionExpired = sub?.status === 'EXPIRED';

      const isStateA = !trialUsed && sub?.status !== 'ACTIVE' && sub?.status !== 'TRIAL';
      const isStateB = !isStateA && sub?.status === 'TRIAL' && isSubscriptionActive;
      const isStateC = !isStateA && !isStateB && (isSubscriptionExpired || sub?.status === 'TRIAL') && !isPaidPlan;
      const isStateD = sub?.status === 'ACTIVE' && isPaidPlan;
      const isStateE = !isStateA && !isStateB && !isStateC && !isStateD;

      return { isStateA, isStateB, isStateC, isStateD, isStateE };
    }

    // State A: Unused trial
    const stateA = classifyState({ status: 'PENDING', trialUsed: false, planName: 'FREE_TRIAL' });
    assert(stateA.isStateA && !stateA.isStateB && !stateA.isStateC && !stateA.isStateD && !stateA.isStateE, 'State A: New Tenant / Trial Not Used correctly detected');

    // State B: Active trial
    const stateB = classifyState({
      status: 'TRIAL',
      trialUsed: true,
      planName: 'FREE_TRIAL',
      trialEnd: new Date(Date.now() + 10 * 86400000).toISOString()
    });
    assert(stateB.isStateB && !stateB.isStateA && !stateB.isStateC && !stateB.isStateD && !stateB.isStateE, 'State B: Trial Active correctly detected');

    // State C: Expired trial
    const stateC = classifyState({
      status: 'EXPIRED',
      trialUsed: true,
      planName: 'FREE_TRIAL',
      trialEnd: new Date(Date.now() - 86400000).toISOString()
    });
    assert(stateC.isStateC && !stateC.isStateA && !stateC.isStateB && !stateC.isStateD && !stateC.isStateE, 'State C: Trial Expired correctly detected');

    // State D: Active paid subscription
    const stateD = classifyState({
      status: 'ACTIVE',
      trialUsed: true,
      planName: 'PROFESSIONAL',
      currentPeriodEnd: new Date(Date.now() + 25 * 86400000).toISOString()
    });
    assert(stateD.isStateD && !stateD.isStateA && !stateD.isStateB && !stateD.isStateC && !stateD.isStateE, 'State D: Paid Subscription Active correctly detected');

    // State E: Cancelled/Past Due/Expired paid subscription
    const stateE1 = classifyState({
      status: 'CANCELLED',
      trialUsed: true,
      planName: 'ENTERPRISE',
      currentPeriodEnd: new Date(Date.now() - 86400000).toISOString()
    });
    assert(stateE1.isStateE && !stateE1.isStateA && !stateE1.isStateB && !stateE1.isStateC && !stateE1.isStateD, 'State E: Cancelled paid subscription correctly detected');

    const stateE2 = classifyState({
      status: 'PAST_DUE',
      trialUsed: true,
      planName: 'STARTER',
      currentPeriodEnd: new Date(Date.now() - 86400000).toISOString()
    });
    assert(stateE2.isStateE, 'State E: Past Due paid subscription correctly detected');

    // -------------------------------------------------------------------------
    // Scenario 13: Tenant Isolation & Security
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 13] Multi-tenant isolation for trial enforcement...');
    // Initialize Tenant 2 as unused trial
    await subscriptionService.createInitialSubscription(tenant2.id);
    const sub2Initial = await prisma.subscription.findUnique({ where: { tenantId: tenant2.id } });
    assert(sub2Initial?.trialUsed === false, 'Tenant 2 has trialUsed=false independently of Tenant 1');

    // Tenant 2 starts their trial
    const start2Res = await fetch(`${API_BASE}/subscriptions/start-trial`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token2}`
      }
    });
    assert(start2Res.status === 200, 'Tenant 2 successfully starts their trial');

    const sub2After = await prisma.subscription.findUnique({ where: { tenantId: tenant2.id } });
    assert(sub2After?.trialUsed === true, 'Tenant 2 trialUsed=true');
    assert(sub2After?.status === SubscriptionStatus.TRIAL, 'Tenant 2 status is TRIAL');

    // Tenant 1 subscription was not altered by Tenant 2's action
    const sub1Final = await prisma.subscription.findUnique({ where: { tenantId: tenant1.id } });
    assert(sub1Final?.status === SubscriptionStatus.PAST_DUE, 'Tenant 1 subscription status unchanged by Tenant 2');

    // Endpoint rejects unauthenticated trial start
    const unauthRes = await fetch(`${API_BASE}/subscriptions/start-trial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    assert(unauthRes.status === 401, 'Unauthenticated request rejected with HTTP 401');

  } catch (error: any) {
    console.error('Test Suite encountered fatal exception:', error);
    failed++;
  } finally {
    // Cleanup test tenants
    console.log('\n[Teardown] Cleaning up test tenants...');
    for (const slug of [TENANT_1_SLUG, TENANT_2_SLUG]) {
      const t = await prisma.tenant.findUnique({ where: { slug } });
      if (t) {
        await purgeTenantDemoData(t.id);
        await prisma.auditLog.deleteMany({ where: { tenantId: t.id } });
        await prisma.orderItem.deleteMany({ where: { order: { tenantId: t.id } } });
        await prisma.order.deleteMany({ where: { tenantId: t.id } });
        await prisma.customer.deleteMany({ where: { tenantId: t.id } });
        await prisma.user.deleteMany({ where: { tenantId: t.id } });
        await prisma.subscription.deleteMany({ where: { tenantId: t.id } });
        await prisma.tenant.delete({ where: { id: t.id } });
      }
    }
  }

  console.log('\n================================================================');
  console.log(`  FINAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTrialEnforcementAndPurgeTests();
