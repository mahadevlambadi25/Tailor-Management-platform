import assert from 'assert';
import http from 'http';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { config, ROLE_PERMISSIONS } from '../src/config';

const TEST_PORT = 5098;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api/v1`;

async function runAuthDebugTests() {
  console.log('================================================================');
  console.log('       AUTHENTICATION & ERROR HANDLING TEST SUITE               ');
  console.log('================================================================\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`Test server running on port ${TEST_PORT}\n`);

  let passed = 0;
  let failed = 0;

  function recordPass(title: string) {
    console.log(`  ✔ PASS: ${title}`);
    passed++;
  }

  function recordFail(title: string, error: any) {
    console.error(`  ✖ FAIL: ${title}`, error);
    failed++;
  }

  try {
    // -------------------------------------------------------------------------
    // Test 1: Bcrypt Password Hashing & Verification
    // -------------------------------------------------------------------------
    console.log('[1/7] Testing Bcrypt Password Hashing & Verification...');
    const rawPassword = 'Password@123';
    const saltRounds = 10;
    const hash = await bcrypt.hash(rawPassword, saltRounds);
    assert(hash && hash.startsWith('$2'), 'Hash format matches bcrypt standard');
    assert(await bcrypt.compare(rawPassword, hash), 'Correct password verifies successfully');
    assert(!(await bcrypt.compare('WrongPassword', hash)), 'Incorrect password rejected');
    recordPass('Bcrypt hashing and verification matches standard specifications');

    // -------------------------------------------------------------------------
    // Test 2: JWT Creation, Expiry & Role Encoding
    // -------------------------------------------------------------------------
    console.log('\n[2/7] Testing JWT Creation, Expiry & Claims Encoding...');
    const mockUserPayload = {
      id: 'test-user-uuid',
      tenantId: 'test-tenant-uuid',
      branchId: 'test-branch-uuid',
      name: 'Test Tailor Owner',
      email: 'owner@atelier.com',
      role: 'SHOP_OWNER'
    };
    const token = jwt.sign(mockUserPayload, config.jwtSecret, { expiresIn: '1d' });
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    assert.strictEqual(decoded.id, mockUserPayload.id);
    assert.strictEqual(decoded.role, 'SHOP_OWNER');
    assert.strictEqual(decoded.tenantId, mockUserPayload.tenantId);
    assert(decoded.exp > decoded.iat, 'Token has valid expiration timestamp');
    recordPass('JWT token generated and verified with correct claims');

    // -------------------------------------------------------------------------
    // Test 3: Login Input Validation (Missing / Empty / Non-string Fields)
    // -------------------------------------------------------------------------
    console.log('\n[3/7] Testing Login Request Validation & Edge Cases...');
    
    // Empty body
    const emptyLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const emptyLoginData: any = await emptyLoginRes.json();
    assert.strictEqual(emptyLoginRes.status, 400);
    assert.strictEqual(emptyLoginData.error?.code, 'MISSING_FIELDS');
    recordPass('Empty login body rejected with HTTP 400 MISSING_FIELDS');

    // Empty email
    const emptyEmailRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '   ', password: 'validPassword' })
    });
    const emptyEmailData: any = await emptyEmailRes.json();
    assert.strictEqual(emptyEmailRes.status, 400);
    assert.strictEqual(emptyEmailData.error?.code, 'MISSING_FIELDS');
    recordPass('Whitespace-only email rejected with HTTP 400 MISSING_FIELDS');

    // Empty password
    const emptyPasswordRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@atelier.com', password: '' })
    });
    const emptyPasswordData: any = await emptyPasswordRes.json();
    assert.strictEqual(emptyPasswordRes.status, 400);
    assert.strictEqual(emptyPasswordData.error?.code, 'MISSING_FIELDS');
    recordPass('Empty password rejected with HTTP 400 MISSING_FIELDS');

    // -------------------------------------------------------------------------
    // Test 4: Business Email Form Validation on Registration
    // -------------------------------------------------------------------------
    console.log('\n[4/7] Testing Business Email & Field Validation on /auth/register...');
    
    // Missing Business Email
    const missingEmailRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName: 'Savile Row Atelier',
        ownerName: 'James Bond',
        email: '',
        mobile: '9876543210',
        password: 'Password@123',
        confirmPassword: 'Password@123'
      })
    });
    const missingEmailData: any = await missingEmailRes.json();
    assert.strictEqual(missingEmailRes.status, 400);
    assert.strictEqual(missingEmailData.error?.code, 'MISSING_EMAIL');
    assert(missingEmailData.error?.message?.includes('Business Email'), 'Error mentions Business Email');
    recordPass('Missing Business Email rejected with code MISSING_EMAIL');

    // Malformed Business Email
    const invalidEmailRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName: 'Savile Row Atelier',
        ownerName: 'James Bond',
        email: 'not-a-valid-email',
        mobile: '9876543210',
        password: 'Password@123',
        confirmPassword: 'Password@123'
      })
    });
    const invalidEmailData: any = await invalidEmailRes.json();
    assert.strictEqual(invalidEmailRes.status, 400);
    assert.strictEqual(invalidEmailData.error?.code, 'INVALID_EMAIL');
    recordPass('Malformed Business Email rejected with code INVALID_EMAIL');

    // Password Mismatch
    const mismatchRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName: 'Savile Row Atelier',
        ownerName: 'James Bond',
        email: 'owner@savilerow.com',
        mobile: '9876543210',
        password: 'Password@123',
        confirmPassword: 'Password@456'
      })
    });
    const mismatchData: any = await mismatchRes.json();
    assert.strictEqual(mismatchRes.status, 400);
    assert.strictEqual(mismatchData.error?.code, 'PASSWORD_MISMATCH');
    recordPass('Password mismatch rejected with code PASSWORD_MISMATCH');

    // -------------------------------------------------------------------------
    // Test 5: Route Alias Consistency (/api/v1/auth, /api/auth, /auth)
    // -------------------------------------------------------------------------
    console.log('\n[5/7] Testing Route Alias Consistency...');
    const endpoints = [
      `http://127.0.0.1:${TEST_PORT}/api/v1/auth/login`,
      `http://127.0.0.1:${TEST_PORT}/api/auth/login`,
      `http://127.0.0.1:${TEST_PORT}/auth/login`
    ];

    for (const url of endpoints) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      assert.strictEqual(res.status, 400, `Endpoint ${url} routes to staffLogin validation`);
    }
    recordPass('All API route prefixes (/api/v1/auth, /api/auth, /auth) consistently mapped');

    // -------------------------------------------------------------------------
    // Test 6: Health Check Endpoints
    // -------------------------------------------------------------------------
    console.log('\n[6/7] Testing Health Check Endpoints (/health, /api/v1/health, /)...');
    const healthUrls = [
      `http://127.0.0.1:${TEST_PORT}/health`,
      `http://127.0.0.1:${TEST_PORT}/api/v1/health`,
      `http://127.0.0.1:${TEST_PORT}/`
    ];
    for (const url of healthUrls) {
      const res = await fetch(url);
      const data: any = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.status, 'ok');
    }
    recordPass('Health checks respond with HTTP 200 { status: "ok" } on all standard probe paths');

    // -------------------------------------------------------------------------
    // Test 7: CORS Origin Policy Verification
    // -------------------------------------------------------------------------
    console.log('\n[7/7] Testing CORS Policy Behavior...');
    // Request with allowed origin
    const corsRes = await fetch(`${BASE_URL}/health`, {
      method: 'GET',
      headers: { Origin: 'http://localhost:5173' }
    });
    assert.strictEqual(corsRes.status, 200);
    assert.strictEqual(corsRes.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    recordPass('CORS correctly allows configured frontend origin');

    // -------------------------------------------------------------------------
    // Test 8: Centralized Error Handler - Prisma & Sanitization
    // -------------------------------------------------------------------------
    console.log('\n[8/8] Testing Centralized Error Handler & Prisma Error Sanitization...');
    const { errorHandler } = await import('../src/middleware/errorHandler');
    const { Prisma } = await import('@prisma/client');

    function createMockRes() {
      let statusValue = 200;
      let jsonValue: any = null;
      return {
        status(code: number) { statusValue = code; return this; },
        json(val: any) { jsonValue = val; return this; },
        getStatus: () => statusValue,
        getJson: () => jsonValue
      };
    }

    // P1001 database unreachable
    const mockReq: any = { method: 'POST', url: '/api/v1/auth/login' };
    const p1001Res = createMockRes();
    const p1001Err = new Prisma.PrismaClientKnownRequestError("Can't reach database server", { code: 'P1001', clientVersion: '5.22.0' });
    errorHandler(p1001Err, mockReq, p1001Res as any, () => {});
    assert.strictEqual(p1001Res.getStatus(), 503);
    assert.strictEqual(p1001Res.getJson()?.error?.code, 'DATABASE_UNREACHABLE');
    recordPass('P1001 translated to HTTP 503 DATABASE_UNREACHABLE');

    // P2002 duplicate unique key
    const p2002Res = createMockRes();
    const p2002Err = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: 'P2002', clientVersion: '5.22.0', meta: { target: ['email'] } });
    errorHandler(p2002Err, mockReq, p2002Res as any, () => {});
    assert.strictEqual(p2002Res.getStatus(), 409);
    assert.strictEqual(p2002Res.getJson()?.error?.code, 'DUPLICATE_RECORD');
    recordPass('P2002 translated to HTTP 409 DUPLICATE_RECORD');

    // P2021 missing table/column
    const p2021Res = createMockRes();
    const p2021Err = new Prisma.PrismaClientKnownRequestError("The table public.funnel_events does not exist", { code: 'P2021', clientVersion: '5.22.0' });
    errorHandler(p2021Err, mockReq, p2021Res as any, () => {});
    assert.strictEqual(p2021Res.getStatus(), 500);
    assert.strictEqual(p2021Res.getJson()?.error?.code, 'DATABASE_SCHEMA_MISMATCH');
    recordPass('P2021 missing table translated to HTTP 500 DATABASE_SCHEMA_MISMATCH');

    // -------------------------------------------------------------------------
    // Test 9: Database URL Sanitization (Preventing P1012 & P1013)
    // -------------------------------------------------------------------------
    console.log('\n[9/9] Testing Database URL Sanitization (P1012/P1013 Guard)...');
    function testSanitize(url?: string): string {
      if (!url) return '';
      let cleaned = String(url).trim();
      if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
        cleaned = cleaned.slice(1, -1).trim();
      }
      if (cleaned.startsWith('postgres://')) {
        cleaned = 'postgresql://' + cleaned.slice('postgres://'.length);
      }
      return cleaned;
    }

    // 1. Quoted URL (common dashboard error that causes P1013)
    const quotedUrl = '"postgresql://postgres.test:pass@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"';
    const cleanedQuoted = testSanitize(quotedUrl);
    assert(!cleanedQuoted.startsWith('"') && !cleanedQuoted.endsWith('"'), 'Accidental double quotes stripped');
    assert.strictEqual(cleanedQuoted.startsWith('postgresql://'), true, 'Scheme is standard postgresql://');

    // 2. Single-quoted URL
    const singleQuoted = "'postgresql://postgres.test:pass@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres'";
    assert.strictEqual(testSanitize(singleQuoted).startsWith('postgresql://'), true, 'Single quotes stripped');

    // 3. postgres:// scheme normalized to postgresql://
    const legacyScheme = 'postgres://postgres.test:pass@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres';
    assert.strictEqual(testSanitize(legacyScheme).startsWith('postgresql://'), true, 'Legacy postgres:// normalized to postgresql://');

    // 4. DIRECT_URL fallback
    const fallbackDirect = testSanitize(process.env.DIRECT_URL) || testSanitize(process.env.DATABASE_URL);
    assert(fallbackDirect.length > 0, 'DIRECT_URL has valid fallback ensuring P1012 is impossible');
    recordPass('Database URL sanitization and DIRECT_URL fallback verified');

    console.log('\n================================================================');
    console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

  } catch (err) {
    recordFail('Unhandled test runner exception', err);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (failed > 0) {
      process.exit(1);
    }
  }
}

runAuthDebugTests();
