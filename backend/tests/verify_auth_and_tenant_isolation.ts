import jwt from 'jsonwebtoken';
import { prisma } from '../src/core/prisma';
import { config } from '../src/config';
import { app } from '../src/app';
import http from 'http';

const BASE_URL = 'http://localhost:5000';

async function runVerification() {
  console.log('===============================================================');
  console.log('  AUTH & TENANT ISOLATION FULL VERIFICATION TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;
  let localServer: any = null;

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
    try {
      await fetch(`${BASE_URL}/api/v1/health`);
    } catch {
      localServer = http.createServer(app);
      await new Promise<void>((resolve) => localServer.listen(5000, resolve));
    }
    // -------------------------------------------------------------------------
    // STEP 3: VERIFY LOGIN
    // -------------------------------------------------------------------------
    console.log('[STEP 3] Testing Login API, Credentials, Status Codes & Security...');

    // 1. Correct email/password succeeds
    const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: 'royal-bespoke',
        email: 'owner@royalbespoke.com',
        password: 'Password@123'
      })
    });
    const loginData: any = await loginRes.json();
    assert(loginRes.status === 200, 'Correct email/password returns HTTP 200', `Status: ${loginRes.status}`);
    assert(loginData.success === true, 'Response success is true');
    assert(typeof loginData.data?.token === 'string' && loginData.data.token.length > 20, 'JWT token generated and returned');

    // Verify token payload
    const decodedToken: any = jwt.verify(loginData.data.token, config.jwtSecret);
    assert(decodedToken.email === 'owner@royalbespoke.com', 'JWT decoded email matches');
    assert(decodedToken.role === 'SHOP_OWNER', 'JWT decoded role matches');

    // Verify password is never returned
    const userObj = loginData.data?.user;
    assert(userObj && !userObj.password && !userObj.passwordHash, 'Password and passwordHash NEVER returned in response');
    assert(userObj.email === 'owner@royalbespoke.com', 'User object has correct email');
    assert(userObj.tenant?.slug === 'royal-bespoke', 'User tenant is correctly identified as royal-bespoke');

    // 2. Incorrect password fails safely
    const wrongPassRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: 'royal-bespoke',
        email: 'owner@royalbespoke.com',
        password: 'IncorrectPassword!999'
      })
    });
    const wrongPassData: any = await wrongPassRes.json();
    assert(wrongPassRes.status === 401, 'Incorrect password returns HTTP 401', `Status: ${wrongPassRes.status}`);
    assert(wrongPassData.success === false, 'Incorrect password success is false');
    assert(wrongPassData.error?.code === 'INVALID_CREDENTIALS', 'Error code is INVALID_CREDENTIALS');

    // 3. Invalid/non-existing user fails safely
    const nonUserRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: 'royal-bespoke',
        email: 'ghost.user.doesnotexist@example.com',
        password: 'Password@123'
      })
    });
    const nonUserData: any = await nonUserRes.json();
    assert(nonUserRes.status === 401, 'Non-existing user returns HTTP 401', `Status: ${nonUserRes.status}`);
    assert(nonUserData.error?.code === 'INVALID_CREDENTIALS', 'Non-existing user returns identical safe INVALID_CREDENTIALS error');

    // 4. Missing fields validation
    const missingFieldsRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@royalbespoke.com' })
    });
    const missingFieldsData: any = await missingFieldsRes.json();
    assert(missingFieldsRes.status === 400, 'Missing password returns HTTP 400', `Status: ${missingFieldsRes.status}`);
    assert(missingFieldsData.error?.code === 'MISSING_FIELDS', 'Error code is MISSING_FIELDS');

    // 5. Login without tenantSlug in body (auto-resolution by email)
    const noSlugRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@royalbespoke.com',
        password: 'Password@123'
      })
    });
    const noSlugData: any = await noSlugRes.json();
    assert(noSlugRes.status === 200, 'Login without tenantSlug body returns HTTP 200');
    assert(noSlugData.data?.user?.tenant?.slug === 'royal-bespoke', 'Tenant correctly auto-resolved to royal-bespoke');

    // 6. Route aliases
    const alias1Res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@royalbespoke.com',
        password: 'Password@123'
      })
    });
    assert(alias1Res.status === 200, 'POST /api/auth/login alias returns HTTP 200');

    // 7. Unmatched route returns clean 404 JSON (not HTML)
    const unmatchedRes = await fetch(`${BASE_URL}/api/v1/auth/nonexistent-endpoint-route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const unmatchedData: any = await unmatchedRes.json();
    assert(unmatchedRes.status === 404, 'Unmatched route returns HTTP 404');
    assert(unmatchedData.error?.code === 'ROUTE_NOT_FOUND', 'Unmatched route returns clean ROUTE_NOT_FOUND JSON');

    // -------------------------------------------------------------------------
    // STEP 4: TENANT ISOLATION
    // -------------------------------------------------------------------------
    console.log('\n[STEP 4] Testing Tenant Isolation & Anti-Spoofing...');

    // Login Tenant A (Royal Bespoke)
    const royalLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: 'royal-bespoke',
        email: 'owner@royalbespoke.com',
        password: 'Password@123'
      })
    });
    const royalData: any = await royalLoginRes.json();
    const royalToken = royalData.data.token;
    const royalTenantId = royalData.data.user.tenant.id;

    // Login Tenant B (Elite Stitching)
    const eliteLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: 'elite-stitching',
        email: 'owner@elitestitching.com',
        password: 'Password@123'
      })
    });
    const eliteData: any = await eliteLoginRes.json();
    const eliteToken = eliteData.data.token;
    const eliteTenantId = eliteData.data.user.tenant.id;

    assert(royalTenantId !== eliteTenantId, 'Tenant A and Tenant B have distinct tenant IDs');
    assert(royalData.data.user.tenant.slug === 'royal-bespoke', 'User A belongs to royal-bespoke');
    assert(eliteData.data.user.tenant.slug === 'elite-stitching', 'User B belongs to elite-stitching');

    // Royal Bespoke fetches customers
    const royalCustomersRes = await fetch(`${BASE_URL}/api/v1/customers`, {
      headers: {
        Authorization: `Bearer ${royalToken}`,
        'x-tenant-slug': 'royal-bespoke'
      }
    });
    const royalCustomers: any = await royalCustomersRes.json();
    assert(royalCustomersRes.status === 200, 'Royal Bespoke user fetches customers (HTTP 200)');
    const customerList = royalCustomers.data?.customers || [];
    const allRoyalMatch = customerList.every((c: any) => c.tenantId === royalTenantId);
    assert(allRoyalMatch, 'All returned customers strictly belong to Royal Bespoke');

    // Anti-spoofing test: Royal Bespoke user sends header 'x-tenant-slug: elite-stitching'
    // The server MUST enforce tenant from the verified JWT, NOT from the arbitrary header!
    const spoofAttemptRes = await fetch(`${BASE_URL}/api/v1/customers`, {
      headers: {
        Authorization: `Bearer ${royalToken}`,
        'x-tenant-slug': 'elite-stitching' // Spoofed header
      }
    });
    const spoofData: any = await spoofAttemptRes.json();
    assert(spoofAttemptRes.status === 200, 'Spoof attempt handled securely (HTTP 200)');
    const spoofList = spoofData.data?.customers || [];
    const noLeak = spoofList.every((c: any) => c.tenantId === royalTenantId);
    assert(noLeak, 'CRITICAL: Server ignored spoofed header and strictly returned authenticated tenant data');

    // Cross-tenant resource access test:
    // If Royal Bespoke user attempts to access an Elite customer or vice versa:
    // Create a temporary customer in Elite Stitching to test direct ID access
    const eliteCustomer = await prisma.customer.upsert({
      where: { tenantId_customerId: { tenantId: eliteTenantId, customerId: 'CUST-ELITE-TEST-99' } },
      update: {},
      create: {
        tenantId: eliteTenantId,
        customerId: 'CUST-ELITE-TEST-99',
        firstName: 'EliteExclusive',
        lastName: 'VIP',
        mobile: '+91 9999900001'
      }
    });

    const crossAccessRes = await fetch(`${BASE_URL}/api/v1/customers/${eliteCustomer.id}`, {
      headers: {
        Authorization: `Bearer ${royalToken}` // Royal Bespoke user trying to read Elite customer
      }
    });
    const crossAccessData: any = await crossAccessRes.json();
    assert(crossAccessRes.status === 404, 'Cross-tenant customer access rejected with HTTP 404 Not Found/Access Denied');
    assert(crossAccessData.error?.code === 'CUSTOMER_NOT_FOUND', 'Cross-tenant error code is CUSTOMER_NOT_FOUND');

    // -------------------------------------------------------------------------
    // STEP 6: TEST PROTECTED API
    // -------------------------------------------------------------------------
    console.log('\n[STEP 6] Testing Protected API Endpoint (GET /api/v1/customers)...');

    // 1. Without token -> rejected (401)
    const noTokenRes = await fetch(`${BASE_URL}/api/v1/customers`);
    const noTokenData: any = await noTokenRes.json();
    assert(noTokenRes.status === 401, 'Request without token rejected with HTTP 401 Unauthorized');
    assert(noTokenData.success === false, 'no-token success is false');

    // 2. With valid token -> allowed (200)
    const validTokenRes = await fetch(`${BASE_URL}/api/v1/customers`, {
      headers: { Authorization: `Bearer ${royalToken}` }
    });
    assert(validTokenRes.status === 200, 'Request with valid token allowed with HTTP 200 OK');

    // 3. With invalid/expired token -> rejected (401)
    const invalidTokenRes = await fetch(`${BASE_URL}/api/v1/customers`, {
      headers: { Authorization: 'Bearer this.is.an.invalid.or.expired.jwt.token' }
    });
    const invalidTokenData: any = await invalidTokenRes.json();
    assert(invalidTokenRes.status === 401, 'Request with invalid token rejected with HTTP 401 Unauthorized');
    assert(invalidTokenData.error?.code === 'TOKEN_INVALID', 'Invalid token returns TOKEN_INVALID');

    // 4. Test GET /api/v1/auth/me
    const meRes = await fetch(`${BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${royalToken}` }
    });
    const meData: any = await meRes.json();
    assert(meRes.status === 200, 'GET /api/v1/auth/me returns HTTP 200');
    assert(meData.data?.user?.email === 'owner@royalbespoke.com', 'auth/me user profile matches');
    assert(Array.isArray(meData.data?.permissions), 'auth/me returns permissions array');

    console.log('\n===============================================================');
    console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Test execution failed:', err);
    process.exit(1);
  } finally {
    if (localServer) {
      localServer.close();
    }
    await prisma.$disconnect();
  }
}

runVerification();
