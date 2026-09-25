import http from 'http';
import { prisma } from '../src/core/prisma';
import { GoogleAuthService } from '../src/modules/auth/googleAuthService';

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

function request(method: string, path: string, body?: any, headers?: Record<string, string>): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith('http') ? path : `${BASE_URL}${path}`);
    const postData = body ? JSON.stringify(body) : '';

    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers
    };

    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData).toString();
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed = raw;
          try {
            parsed = JSON.parse(raw);
          } catch {}
          resolve({ status: res.statusCode || 0, headers: res.headers, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✔ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ✖ FAIL: ${msg}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('  AUTHENTICATION UI/UX FLOW & COMPREHENSIVE REGRESSION TESTS');
  console.log('===============================================================\n');

  // Test 1: Email / Password Login
  console.log('[TEST 1] Email / Password Login...');
  {
    const res = await request('POST', '/auth/login', {
      email: 'owner@royalbespoke.com',
      password: 'Password@123',
      tenantSlug: 'royal-bespoke'
    });
    assert(res.status === 200, 'Existing owner login returns HTTP 200');
    assert(res.body.success === true, 'Response success is true');
    assert(!!res.body.data?.token, 'JWT token returned in response');
    assert(res.body.data?.user?.email === 'owner@royalbespoke.com', 'User email matches');

    // Invalid password
    const badRes = await request('POST', '/auth/login', {
      email: 'owner@royalbespoke.com',
      password: 'WrongPassword!',
      tenantSlug: 'royal-bespoke'
    });
    assert(badRes.status === 401, 'Invalid password returns HTTP 401');
    assert(badRes.body.error?.code === 'INVALID_CREDENTIALS', 'Error code is INVALID_CREDENTIALS');
  }

  // Test 2: Register Flow
  console.log('\n[TEST 2] Register Flow...');
  const testRegEmail = `test-reg-${Date.now()}@example.com`;
  {
    // Mismatched passwords
    const mismatchRes = await request('POST', '/auth/register', {
      name: 'Test Tailor',
      email: testRegEmail,
      password: 'Password@123',
      confirmPassword: 'MismatchPassword!'
    });
    assert(mismatchRes.status === 400, 'Password mismatch returns HTTP 400');
    assert(mismatchRes.body.error?.code === 'PASSWORD_MISMATCH', 'Error code is PASSWORD_MISMATCH');

    // Password too short
    const shortRes = await request('POST', '/auth/register', {
      name: 'Test Tailor',
      email: testRegEmail,
      password: '123',
      confirmPassword: '123'
    });
    assert(shortRes.status === 400, 'Short password returns HTTP 400');
    assert(shortRes.body.error?.code === 'PASSWORD_TOO_SHORT', 'Error code is PASSWORD_TOO_SHORT');

    // Successful registration
    const regRes = await request('POST', '/auth/register', {
      name: 'Bespoke Atelier Test',
      email: testRegEmail,
      password: 'Password@123',
      confirmPassword: 'Password@123'
    });
    assert(regRes.status === 201, 'Valid registration returns HTTP 201');
    assert(regRes.body.success === true, 'Registration success is true');
    assert(!!regRes.body.data?.token, 'Token returned on registration');
    assert(regRes.body.data?.user?.role === 'SHOP_OWNER', 'New registrant is assigned SHOP_OWNER');
    const tenantInDb = await prisma.tenant.findUnique({ where: { id: regRes.body.data?.user?.tenant?.id } });
    assert(tenantInDb?.isDemo === false, 'New tenant is not a demo tenant');

    // Duplicate registration attempt
    const dupRes = await request('POST', '/auth/register', {
      name: 'Duplicate Tailor',
      email: testRegEmail,
      password: 'Password@123',
      confirmPassword: 'Password@123'
    });
    assert(dupRes.status === 400, 'Duplicate registration returns HTTP 400');
    assert(dupRes.body.error?.code === 'EMAIL_ALREADY_EXISTS', 'Duplicate error code is EMAIL_ALREADY_EXISTS');

    // Clean up test registration
    const regUser = await prisma.user.findFirst({ where: { email: testRegEmail } });
    if (regUser) {
      await prisma.user.delete({ where: { id: regUser.id } });
      await prisma.subscription.deleteMany({ where: { tenantId: regUser.tenantId } });
      await prisma.branch.deleteMany({ where: { tenantId: regUser.tenantId } });
      await prisma.auditLog.deleteMany({ where: { tenantId: regUser.tenantId } });
      await prisma.tenant.delete({ where: { id: regUser.tenantId } });
    }
  }

  // Test 3: Google Login Flow (Existing User)
  console.log('\n[TEST 3] Google Login Flow (Existing User)...');
  {
    const result = await GoogleAuthService.authenticateOrRegisterGoogleUser({
      email: 'owner@royalbespoke.com',
      name: 'Royal Owner'
    });
    assert(result.isNewUser === false, 'Existing Google email detected as isNewUser=false');
    assert(result.user.email === 'owner@royalbespoke.com', 'Existing email returned');
    assert(result.user.tenant.slug === 'royal-bespoke', 'Mapped to existing royal-bespoke tenant');
    assert(!!result.token, 'JWT issued for existing user');
  }

  // Test 4: Google New-User Registration Flow
  console.log('\n[TEST 4] Google New-User Registration Flow...');
  const newGoogleEmail = `new-google-user-${Date.now()}@gmail.com`;
  {
    const result = await GoogleAuthService.authenticateOrRegisterGoogleUser({
      email: newGoogleEmail,
      name: 'Google Atelier Owner'
    });
    assert(result.isNewUser === true, 'New Google email detected as isNewUser=true');
    assert(result.user.role === 'SHOP_OWNER', 'New Google user assigned SHOP_OWNER');
    assert(result.user.tenant.slug !== 'royal-bespoke', 'New tenant isolated from royal-bespoke');
    assert(result.user.tenant.slug !== 'demo-tailors', 'New tenant isolated from demo-tailors');

    // Subsequent call with same email logs in without duplicating
    const secondResult = await GoogleAuthService.authenticateOrRegisterGoogleUser({
      email: newGoogleEmail,
      name: 'Google Atelier Owner'
    });
    assert(secondResult.isNewUser === false, 'Subsequent login recognized as existing user');
    assert(secondResult.user.id === result.user.id, 'User ID matches previous creation (no duplicates)');

    // Cleanup
    const gUser = await prisma.user.findFirst({ where: { email: newGoogleEmail } });
    if (gUser) {
      await prisma.user.delete({ where: { id: gUser.id } });
      await prisma.subscription.deleteMany({ where: { tenantId: gUser.tenantId } });
      await prisma.branch.deleteMany({ where: { tenantId: gUser.tenantId } });
      await prisma.auditLog.deleteMany({ where: { tenantId: gUser.tenantId } });
      await prisma.tenant.delete({ where: { id: gUser.tenantId } });
    }
  }

  // Test 5: All 4 Demo Login Options
  console.log('\n[TEST 5] Testing All 4 Demo Login Accounts...');
  {
    // 1. Shop Owner
    const ownerRes = await request('POST', '/auth/login', {
      email: 'owner@royalbespoke.com',
      password: 'Password@123',
      tenantSlug: 'royal-bespoke'
    }, { 'x-tenant-slug': 'royal-bespoke' });
    assert(ownerRes.status === 200, 'Demo 1 (Shop Owner) returns HTTP 200');
    assert(ownerRes.body.data?.user?.role === 'SHOP_OWNER', 'Shop Owner role matches');

    // 2. Demo Atelier
    const atelierRes = await request('POST', '/auth/login', {
      email: 'owner@demo-tailors.com',
      password: 'Password@123',
      tenantSlug: 'demo-tailors'
    }, { 'x-tenant-slug': 'demo-tailors' });
    assert(atelierRes.status === 200, 'Demo 2 (Demo Atelier) returns HTTP 200');
    assert(atelierRes.body.data?.user?.tenant?.slug === 'demo-tailors', 'Demo Atelier tenant slug is demo-tailors');

    // 3. Receptionist
    const receptionistRes = await request('POST', '/auth/login', {
      email: 'receptionist@royalbespoke.com',
      password: 'Password@123',
      tenantSlug: 'royal-bespoke'
    }, { 'x-tenant-slug': 'royal-bespoke' });
    assert(receptionistRes.status === 200, 'Demo 3 (Receptionist) returns HTTP 200');
    assert(receptionistRes.body.data?.user?.role === 'RECEPTIONIST', 'Receptionist role matches');

    // 4. Master Tailor
    const tailorRes = await request('POST', '/auth/login', {
      email: 'tailor@royalbespoke.com',
      password: 'Password@123',
      tenantSlug: 'royal-bespoke'
    }, { 'x-tenant-slug': 'royal-bespoke' });
    assert(tailorRes.status === 200, 'Demo 4 (Master Tailor) returns HTTP 200');
    assert(tailorRes.body.data?.user?.role === 'TAILOR', 'Master Tailor role matches');
  }

  // Test 6: Google Callback Redirect
  console.log('\n[TEST 6] Google Callback Redirect...');
  {
    const missingCodeRes = await request('GET', '/auth/google/callback');
    assert(missingCodeRes.status === 302, 'Callback without code redirects (HTTP 302)');
    assert(String(missingCodeRes.headers.location).includes('error=MISSING_OAUTH_CODE'), 'Redirects with MISSING_OAUTH_CODE error parameter');

    const errCallbackRes = await request('GET', '/auth/google/callback?error=access_denied');
    assert(errCallbackRes.status === 302, 'Callback with error query redirects (HTTP 302)');
    assert(String(errCallbackRes.headers.location).includes('error=access_denied'), 'Passes through oauth error parameter');
  }

  console.log('\n===============================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
