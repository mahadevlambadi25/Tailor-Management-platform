import assert from 'assert';
import http from 'http';
import { app } from '../src/app';
import { prisma } from '../src/core/prisma';

const PORT = 5057;
const BASE_URL = `http://127.0.0.1:${PORT}/api/v1`;

async function runTests() {
  console.log('================================================================');
  console.log('       TAILOR SAAS REGISTRATION WORKFLOW TEST SUITE             ');
  console.log('================================================================\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`Ephemeral test server running on port ${PORT}\n`);

  try {
    const uniqueSuffix = Date.now().toString(36);
    const testEmail = `test_owner_${uniqueSuffix}@example.com`;
    const validMobile = '9876543210';
    const validShopName = `Royal Bespoke Tailors ${uniqueSuffix}`;
    const validOwnerName = 'Mahadev Lambadi';
    const validPassword = 'Password123!';

    // -------------------------------------------------------------
    // Test 1: Missing Shop Name
    // -------------------------------------------------------------
    console.log('--- Test 1: Missing Shop Name validation ---');
    const missingShopRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName: '',
        ownerName: validOwnerName,
        email: testEmail,
        mobile: validMobile,
        password: validPassword,
        confirmPassword: validPassword
      })
    });
    const missingShopData: any = await missingShopRes.json();
    assert(missingShopRes.status === 400, 'Rejects empty shopName with HTTP 400');
    assert(missingShopData.error?.code === 'MISSING_SHOP_NAME' || missingShopData.error?.message?.includes('Shop Name'), 'Error indicates missing shop name');
    console.log('✔ PASS: Missing shop name rejected correctly');

    // -------------------------------------------------------------
    // Test 2: Missing Owner Name
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Missing Owner Name validation ---');
    const missingOwnerRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName: validShopName,
        ownerName: '',
        email: testEmail,
        mobile: validMobile,
        password: validPassword,
        confirmPassword: validPassword
      })
    });
    const missingOwnerData: any = await missingOwnerRes.json();
    assert(missingOwnerRes.status === 400, 'Rejects empty ownerName with HTTP 400');
    assert(missingOwnerData.error?.code === 'MISSING_OWNER_NAME' || missingOwnerData.error?.message?.includes('Owner Name'), 'Error indicates missing owner name');
    console.log('✔ PASS: Missing owner name rejected correctly');

    // -------------------------------------------------------------
    // Test 3: Invalid Email Format
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Invalid Email validation ---');
    const invalidEmailRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName: validShopName,
        ownerName: validOwnerName,
        email: 'not-an-email',
        mobile: validMobile,
        password: validPassword,
        confirmPassword: validPassword
      })
    });
    const invalidEmailData: any = await invalidEmailRes.json();
    assert(invalidEmailRes.status === 400, 'Rejects malformed email with HTTP 400');
    assert(invalidEmailData.error?.code === 'INVALID_EMAIL' || invalidEmailData.error?.message?.includes('email'), 'Error indicates invalid email');
    console.log('✔ PASS: Invalid email format rejected correctly');

    // -------------------------------------------------------------
    // Test 4: Mobile Validation (Empty & Invalid)
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Mobile Number validation ---');
    const missingMobileRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName: validShopName,
        ownerName: validOwnerName,
        email: testEmail,
        mobile: '',
        password: validPassword,
        confirmPassword: validPassword
      })
    });
    const missingMobileData: any = await missingMobileRes.json();
    assert(missingMobileRes.status === 400, 'Rejects empty mobile with HTTP 400');
    assert(missingMobileData.error?.code === 'MISSING_MOBILE', 'Error code is MISSING_MOBILE');

    const invalidMobileRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName: validShopName,
        ownerName: validOwnerName,
        email: testEmail,
        mobile: '12345',
        password: validPassword,
        confirmPassword: validPassword
      })
    });
    const invalidMobileData: any = await invalidMobileRes.json();
    assert(invalidMobileRes.status === 400, 'Rejects short mobile with HTTP 400');
    assert(invalidMobileData.error?.code === 'INVALID_MOBILE', 'Error code is INVALID_MOBILE');
    console.log('✔ PASS: Mobile validation rejected invalid inputs correctly');

    // -------------------------------------------------------------
    // Test 5: Password Mismatch & Too Short
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Password Mismatch & Short validation ---');
    const mismatchRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName: validShopName,
        ownerName: validOwnerName,
        email: testEmail,
        mobile: validMobile,
        password: validPassword,
        confirmPassword: 'DifferentPassword!'
      })
    });
    const mismatchData: any = await mismatchRes.json();
    assert(mismatchRes.status === 400, 'Rejects password mismatch with HTTP 400');
    assert(mismatchData.error?.code === 'PASSWORD_MISMATCH', 'Error code is PASSWORD_MISMATCH');

    const shortPassRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName: validShopName,
        ownerName: validOwnerName,
        email: testEmail,
        mobile: validMobile,
        password: '123',
        confirmPassword: '123'
      })
    });
    const shortPassData: any = await shortPassRes.json();
    assert(shortPassRes.status === 400, 'Rejects short password with HTTP 400');
    assert(shortPassData.error?.code === 'PASSWORD_TOO_SHORT', 'Error code is PASSWORD_TOO_SHORT');
    console.log('✔ PASS: Password mismatch and short password rejected correctly');

    // -------------------------------------------------------------
    // Test 6: Successful Registration with Full Business Data
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Successful Registration ---');
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName: validShopName,
        ownerName: validOwnerName,
        email: testEmail,
        mobile: validMobile,
        password: validPassword,
        confirmPassword: validPassword
      })
    });
    const regData: any = await regRes.json();
    assert(regRes.status === 201, `Expected HTTP 201, got ${regRes.status}: ${JSON.stringify(regData)}`);
    assert(regData.success === true, 'Response success is true');
    assert(!!regData.data.token, 'Auth token returned');
    assert(regData.data.user.name === validOwnerName, `User name matches owner: ${regData.data.user.name}`);
    assert(regData.data.user.tenant.name === validShopName, `Tenant name matches shop: ${regData.data.user.tenant.name}`);

    const createdTenantId = regData.data.user.tenant.id;
    const createdUserId = regData.data.user.id;
    const createdToken = regData.data.token;
    console.log('✔ PASS: Registration succeeded with full token and user payload');

    // -------------------------------------------------------------
    // Test 7: Duplicate Email Registration Rejection
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Duplicate Email Rejection ---');
    const dupRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName: 'Another Shop',
        ownerName: 'Another Owner',
        email: testEmail,
        mobile: '9123456780',
        password: validPassword,
        confirmPassword: validPassword
      })
    });
    const dupData: any = await dupRes.json();
    assert(dupRes.status === 400, 'Rejects duplicate email with HTTP 400');
    assert(dupData.error?.code === 'EMAIL_ALREADY_EXISTS', 'Error code is EMAIL_ALREADY_EXISTS');
    console.log('✔ PASS: Duplicate email rejected correctly');

    // -------------------------------------------------------------
    // Test 8: Verify Database Persistence of Shop Name & Owner Name
    // -------------------------------------------------------------
    console.log('\n--- Test 8: Verify Database Persistence ---');
    const dbTenant = await prisma.tenant.findUnique({
      where: { id: createdTenantId }
    });
    assert(dbTenant !== null, 'Tenant exists in database');
    assert(dbTenant?.name === validShopName, `Tenant.name is exactly "${validShopName}" (actual: "${dbTenant?.name}")`);
    assert(dbTenant?.phone === `+91 ${validMobile}`, `Tenant.phone is normalized "+91 ${validMobile}" (actual: "${dbTenant?.phone}")`);
    assert(dbTenant?.email === testEmail, `Tenant.email is "${testEmail}"`);
    assert(dbTenant?.isDemo === false, 'Tenant isDemo is FALSE (Clean workspace)');
    assert(dbTenant?.onboardingCompleted === false, 'Tenant onboardingCompleted is initially FALSE');

    const dbUser = await prisma.user.findUnique({
      where: { id: createdUserId }
    });
    assert(dbUser !== null, 'User exists in database');
    assert(dbUser?.name === validOwnerName, `User.name is exactly "${validOwnerName}" (actual: "${dbUser?.name}")`);
    assert(dbUser?.phone === `+91 ${validMobile}`, `User.phone is normalized "+91 ${validMobile}"`);
    assert(dbUser?.email === testEmail, `User.email is "${testEmail}"`);
    assert(dbUser?.role === 'SHOP_OWNER', 'User role is SHOP_OWNER');
    console.log('✔ PASS: Database persistence of Shop Name, Owner Name, and Mobile verified');

    // -------------------------------------------------------------
    // Test 9: Verify Clean Workspace (Zero Sample Records)
    // -------------------------------------------------------------
    console.log('\n--- Test 9: Verify Clean Workspace (0 Sample Records) ---');
    const customerCount = await prisma.customer.count({ where: { tenantId: createdTenantId } });
    const orderCount = await prisma.order.count({ where: { tenantId: createdTenantId } });
    const staffCount = await prisma.user.count({ where: { tenantId: createdTenantId, role: { not: 'SHOP_OWNER' } } });

    assert(customerCount === 0, `Expected 0 customers, found ${customerCount}`);
    assert(orderCount === 0, `Expected 0 orders, found ${orderCount}`);
    assert(staffCount === 0, `Expected 0 non-owner staff, found ${staffCount}`);
    console.log('✔ PASS: Clean workspace verified with 0 customers, 0 orders, 0 non-owner staff');

    // -------------------------------------------------------------
    // Test 10: Verify 14-Day Free Trial Subscription
    // -------------------------------------------------------------
    console.log('\n--- Test 10: Verify 14-Day Free Trial Subscription ---');
    const dbSub = await prisma.subscription.findUnique({ where: { tenantId: createdTenantId } });
    assert(dbSub !== null, 'Subscription provisioned');
    assert(dbSub?.status === 'TRIAL', `Subscription status is TRIAL (actual: ${dbSub?.status})`);
    assert(dbSub?.planName === 'FREE_TRIAL', `Plan name is FREE_TRIAL (actual: ${dbSub?.planName})`);
    assert(dbSub?.trialUsed === true, 'trialUsed is true');
    console.log('✔ PASS: 14-day free trial active on new workspace');

    // -------------------------------------------------------------
    // Test 11: Verify Quick Workshop Setup Status (onboardingCompleted: false)
    // -------------------------------------------------------------
    console.log('\n--- Test 11: Verify Quick Workshop Setup Status ---');
    const statusRes = await fetch(`${BASE_URL}/conversion/onboarding/status`, {
      headers: { Authorization: `Bearer ${createdToken}` }
    });
    const statusData: any = await statusRes.json();
    assert(statusRes.status === 200, 'GET /conversion/onboarding/status returns HTTP 200');
    assert(statusData.success === true, 'Status response is true');
    assert(statusData.data.completed === false, `Quick Workshop Setup modal must be pending for new tenant (completed: ${statusData.data.completed})`);
    console.log('✔ PASS: Quick Workshop Setup modal is correctly triggered for new shop');

    // -------------------------------------------------------------
    // Test 12: Verify Login with Newly Created Credentials
    // -------------------------------------------------------------
    console.log('\n--- Test 12: Verify Login with New Credentials ---');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: validPassword
      })
    });
    const loginData: any = await loginRes.json();
    assert(loginRes.status === 200, `Login returns HTTP 200 (actual: ${loginRes.status})`);
    assert(loginData.success === true, 'Login successful');
    assert(!!loginData.data.token, 'Token received on login');
    assert(loginData.data.user.name === validOwnerName, 'Logged in user has owner name');
    assert(loginData.data.user.tenant.name === validShopName, 'Logged in user has shop name');
    console.log('✔ PASS: Login with new shop owner credentials verified');

    // -------------------------------------------------------------
    // Test 13: Backward Compatibility with Legacy Payload ({ name, email, password })
    // -------------------------------------------------------------
    console.log('\n--- Test 13: Backward Compatibility with Legacy Payload ---');
    const legacyEmail = `legacy_${uniqueSuffix}@example.com`;
    const legacyName = `Legacy Tailors ${uniqueSuffix}`;
    const legacyRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: legacyName,
        email: legacyEmail,
        password: validPassword,
        confirmPassword: validPassword
      })
    });
    const legacyData: any = await legacyRes.json();
    assert(legacyRes.status === 201, `Legacy register returns HTTP 201 (actual: ${legacyRes.status})`);
    assert(legacyData.data.user.tenant.name === legacyName, 'Legacy tenant name created');
    assert(legacyData.data.user.tenant.slug.startsWith('legacy-tailors'), 'Legacy slug created properly');
    console.log('✔ PASS: Backward compatibility preserved for legacy API requests');

    // Clean up test tenants
    await prisma.tenant.deleteMany({
      where: { id: { in: [createdTenantId, legacyData.data.user.tenant.id] } }
    });
    console.log('\n✔ Test cleanup completed.');

    console.log('\n================================================================');
    console.log('  ALL REGISTRATION TESTS PASSED (13/13)                         ');
    console.log('================================================================');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
