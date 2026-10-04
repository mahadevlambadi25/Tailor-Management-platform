import { app } from '../src/app';
import { prisma } from '../src/core/prisma';
import http from 'http';
import assert from 'assert';

async function runOnboardingTests() {
  console.log('================================================================');
  console.log('       ONBOARDING MODAL PERSISTENCE & ISOLATION TEST SUITE       ');
  console.log('================================================================\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  try {
    // -------------------------------------------------------------
    // Test 1: New Tenant Signup (Genuinely new shop)
    // -------------------------------------------------------------
    console.log('\n--- Test 1: Register New Tenant A (Clean shop) ---');
    const emailA = `new.owner.a.${Date.now()}@example.com`;
    const regResA = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Atelier A',
        email: emailA,
        password: 'Password123!',
        confirmPassword: 'Password123!'
      })
    });
    const regDataA: any = await regResA.json();
    assert.strictEqual(regResA.status, 201, 'Tenant A registration must succeed');
    const tokenA = regDataA.data.token;
    const tenantIdA = regDataA.data.user.tenant.id;

    // Check status immediately on first dashboard mount
    const statusResA1 = await fetch(`${baseUrl}/conversion/onboarding/status`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const statusDataA1: any = await statusResA1.json();
    assert.strictEqual(statusResA1.status, 200);
    assert.strictEqual(statusDataA1.data.completed, false, 'New shop must have completed === false');
    assert.strictEqual(statusDataA1.data.onboardingCompleted, false, 'New shop must have onboardingCompleted === false');
    console.log('✔ PASS: New shop receives completed: false initially (modal shows)');

    // -------------------------------------------------------------
    // Test 2: Complete onboarding for Tenant A
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Complete onboarding for Tenant A ---');
    const submitResA = await fetch(`${baseUrl}/conversion/onboarding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        shopType: 'Ladies tailoring',
        teamSize: '2 to 5',
        shopCount: 'One',
        skipped: false
      })
    });
    const submitDataA: any = await submitResA.json();
    assert.strictEqual(submitResA.status, 200);
    assert.strictEqual(submitDataA.data.completed, true, 'Submit returns completed: true');
    assert.strictEqual(submitDataA.data.onboardingCompleted, true, 'Submit returns onboardingCompleted: true');
    console.log('✔ PASS: Onboarding submission persists completed: true');

    // Verify DB record directly
    const tenantDbA = await prisma.tenant.findUnique({ where: { id: tenantIdA } });
    assert.strictEqual(tenantDbA?.onboardingCompleted, true, 'Tenant A DB record has onboardingCompleted === true');
    assert.strictEqual(tenantDbA?.shopType, 'Ladies tailoring');
    console.log('✔ PASS: Database Tenant record has onboardingCompleted === true');

    // Simulate returning to Dashboard (subsequent query)
    const statusResA2 = await fetch(`${baseUrl}/conversion/onboarding/status`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const statusDataA2: any = await statusResA2.json();
    assert.strictEqual(statusDataA2.data.completed, true, 'Returning shop receives completed: true');
    assert.strictEqual(statusDataA2.data.onboardingCompleted, true, 'Returning shop receives onboardingCompleted: true');
    console.log('✔ PASS: Returning to Dashboard maintains completed: true (modal NEVER reopens)');

    // -------------------------------------------------------------
    // Test 3: Tenant Isolation - Register Tenant B
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Tenant Isolation - Register New Tenant B ---');
    const emailB = `new.owner.b.${Date.now()}@example.com`;
    const regResB = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Atelier B',
        email: emailB,
        password: 'Password123!',
        confirmPassword: 'Password123!'
      })
    });
    const regDataB: any = await regResB.json();
    assert.strictEqual(regResB.status, 201);
    const tokenB = regDataB.data.token;
    const tenantIdB = regDataB.data.user.tenant.id;

    // Tenant B must NOT be affected by Tenant A's completed onboarding!
    const statusResB1 = await fetch(`${baseUrl}/conversion/onboarding/status`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const statusDataB1: any = await statusResB1.json();
    assert.strictEqual(statusDataB1.data.completed, false, 'Tenant B must NOT inherit Tenant A completion');
    assert.strictEqual(statusDataB1.data.onboardingCompleted, false, 'Tenant B must be false');
    console.log('✔ PASS: Tenant B is completely isolated and receives completed: false');

    // -------------------------------------------------------------
    // Test 4: Skip / Dismiss onboarding for Tenant B
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Skip / Dismiss onboarding for Tenant B ---');
    const skipResB = await fetch(`${baseUrl}/conversion/onboarding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`
      },
      body: JSON.stringify({
        skipped: true
      })
    });
    const skipDataB: any = await skipResB.json();
    assert.strictEqual(skipResB.status, 200);
    assert.strictEqual(skipDataB.data.completed, true, 'Skipping marks completed: true');
    assert.strictEqual(skipDataB.data.onboardingCompleted, true, 'Skipping marks onboardingCompleted: true');

    const tenantDbB = await prisma.tenant.findUnique({ where: { id: tenantIdB } });
    assert.strictEqual(tenantDbB?.onboardingCompleted, true, 'Tenant B DB record has onboardingCompleted === true after skip');

    // Subsequent status check for Tenant B
    const statusResB2 = await fetch(`${baseUrl}/conversion/onboarding/status`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const statusDataB2: any = await statusResB2.json();
    assert.strictEqual(statusDataB2.data.completed, true, 'Tenant B after skip receives completed: true');
    console.log('✔ PASS: Skipped shop maintains completed: true (modal NEVER reopens)');

    // -------------------------------------------------------------
    // Test 5: Existing Demo Tenants
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Existing Demo Tenants (e.g. Royal Bespoke) ---');
    const royal = await prisma.tenant.findUnique({ where: { slug: 'royal-bespoke' } });
    if (royal) {
      // Login as owner@royalbespoke.com
      const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: 'royal-bespoke',
          email: 'owner@royalbespoke.com',
          password: 'Password@123'
        })
      });
      const loginData: any = await loginRes.json();
      assert.strictEqual(loginRes.status, 200);
      const royalToken = loginData.data.token;

      const royalStatusRes = await fetch(`${baseUrl}/conversion/onboarding/status`, {
        headers: { Authorization: `Bearer ${royalToken}` }
      });
      const royalStatusData: any = await royalStatusRes.json();
      assert.strictEqual(royalStatusData.data.completed, true, 'Royal Bespoke demo tenant must have completed === true');
      console.log('✔ PASS: Existing demo tenant (Royal Bespoke) has completed === true (no modal)');
    }

    // Cleanup ephemeral tenants
    await prisma.user.deleteMany({ where: { tenantId: { in: [tenantIdA, tenantIdB] } } });
    await prisma.branch.deleteMany({ where: { tenantId: { in: [tenantIdA, tenantIdB] } } });
    await prisma.subscription.deleteMany({ where: { tenantId: { in: [tenantIdA, tenantIdB] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantIdA, tenantIdB] } } });

    console.log('\n================================================================');
    console.log('  ALL ONBOARDING PERSISTENCE & ISOLATION TESTS PASSED (5/5)     ');
    console.log('================================================================\n');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runOnboardingTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
