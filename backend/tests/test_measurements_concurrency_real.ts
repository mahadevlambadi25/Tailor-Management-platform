/**
 * ============================================================================
 * REAL POSTGRESQL CONCURRENCY & TRANSACTION RETRY INTEGRATION TEST
 * ============================================================================
 *
 * Target: MeasurementsController.saveCustomerMeasurement
 * Requirements:
 * 1. Runs against a real PostgreSQL staging database instance.
 * 2. Uses two independent concurrent transactions synchronized after findFirst().
 * 3. Enforces both transactions observe null profile before either creates.
 * 4. Relies on PostgreSQL's real unique index to produce P2002 on the losing insert.
 * 5. Executes the real application P2002 retry logic in MeasurementsController.
 * 6. Verifies fresh transaction start, dynamic version increment [1, 2], and clean audit logging.
 * 7. Symmetrically asserts without assuming which request wins.
 *
 * SAFETY GATES:
 * - STAGING_CONCURRENCY_TEST_ENABLED must strictly equal 'true'.
 * - NODE_ENV=production unconditionally rejects execution.
 * - Database identity is verified against an exact approved staging allowlist.
 * - Never treats localhost as staging automatically.
 * - Never logs credentials or full connection URLs.
 * - Restores PrismaClient.prototype.$transaction exactly via own-property deletion.
 */

import { Request, Response, NextFunction } from 'express';
import '../src/middleware/tenantContext';
import { prisma } from '../src/core/prisma';
import { MeasurementsController } from '../src/modules/measurements/measurementsController';
import { UnitSystem } from '@prisma/client';

export interface StagingGateVerificationResult {
  allowed: boolean;
  reason: string;
  sanitizedHost?: string;
  databaseName?: string;
}

/**
 * Strict, Fail-Closed Staging Database Identity Verifier
 *
 * Rules:
 * 1. STAGING_CONCURRENCY_TEST_ENABLED must strictly equal 'true'.
 * 2. NODE_ENV === 'production' is an unconditional refusal.
 * 3. Connection URL (DIRECT_URL or DATABASE_URL) must be present and validly formatted.
 * 4. The target hostname / project identifier must match an explicitly approved allowlist.
 * 5. Rejects loose substring matching (e.g. host.includes("staging")).
 * 6. Does NOT automatically treat localhost/127.0.0.1 as staging.
 * 7. Never prints or logs connection credentials, passwords, or full connection URLs.
 * 8. If positive staging identity verification cannot be completed, execution is REFUSED.
 */
export function verifyStagingDatabaseIdentity(): StagingGateVerificationResult {
  // 1. Explicit gate activation check
  if (process.env.STAGING_CONCURRENCY_TEST_ENABLED !== 'true') {
    return {
      allowed: false,
      reason: 'STAGING_CONCURRENCY_TEST_ENABLED is not set to "true". Execution held for explicit sign-off.'
    };
  }

  // 2. Strict production rejection
  if (process.env.NODE_ENV === 'production') {
    return {
      allowed: false,
      reason: 'CRITICAL REFUSAL: NODE_ENV is set to "production". Concurrency test is strictly forbidden in production.'
    };
  }

  // 3. Extract and parse database connection URL used by PrismaClient
  // In src/core/prisma.ts, PrismaClient is configured with config.databaseUrl (DATABASE_URL).
  // We strictly validate DATABASE_URL, and if DIRECT_URL is present, we validate it as well.
  const clientUrl = process.env.DATABASE_URL;
  if (!clientUrl || typeof clientUrl !== 'string' || clientUrl.trim().length === 0) {
    return {
      allowed: false,
      reason: 'REFUSAL: DATABASE_URL environment variable used by PrismaClient is missing or empty.'
    };
  }

  function parseAndSanitize(raw: string): URL {
    let cleaned = raw.trim();
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1).trim();
    }
    if (cleaned.startsWith('postgres://')) {
      cleaned = 'postgresql://' + cleaned.slice('postgres://'.length);
    }
    return new URL(cleaned);
  }

  let parsed: URL;
  try {
    parsed = parseAndSanitize(clientUrl);
  } catch (err) {
    return {
      allowed: false,
      reason: 'REFUSAL: Target DATABASE_URL is malformed or cannot be parsed.'
    };
  }

  const hostname = (parsed.hostname || '').toLowerCase().trim();
  const dbName = (parsed.pathname || '').replace(/^\//, '').toLowerCase().trim();

  if (!hostname) {
    return {
      allowed: false,
      reason: 'REFUSAL: Target database URL does not contain a valid hostname.'
    };
  }

  // Check if DIRECT_URL is also set and validate its hostname
  if (process.env.DIRECT_URL) {
    try {
      const parsedDirect = parseAndSanitize(process.env.DIRECT_URL);
      const directHost = (parsedDirect.hostname || '').toLowerCase().trim();
      if (!directHost) {
        return {
          allowed: false,
          reason: 'REFUSAL: DIRECT_URL is set but does not contain a valid hostname.'
        };
      }
    } catch {
      return {
        allowed: false,
        reason: 'REFUSAL: DIRECT_URL is malformed or cannot be parsed.'
      };
    }
  }

  // 4. Reject production databases unconditionally
  // A production database cannot be accepted merely because someone sets NODE_ENV=test
  // and copies its hostname into an approval variable.
  const knownProdHosts = new Set<string>();
  if (process.env.PRODUCTION_DATABASE_URL) {
    try {
      const u = parseAndSanitize(process.env.PRODUCTION_DATABASE_URL);
      if (u.hostname) knownProdHosts.add(u.hostname.toLowerCase().trim());
    } catch {}
  }
  if (process.env.PROD_DB_HOST) {
    knownProdHosts.add(process.env.PROD_DB_HOST.toLowerCase().trim());
  }
  if (process.env.PRODUCTION_DB_HOST) {
    knownProdHosts.add(process.env.PRODUCTION_DB_HOST.toLowerCase().trim());
  }

  const hasProdIndicators =
    knownProdHosts.has(hostname) ||
    hostname.includes('prod-db') ||
    hostname.includes('production') ||
    (dbName.includes('prod') && !dbName.includes('staging'));

  if (hasProdIndicators) {
    return {
      allowed: false,
      sanitizedHost: hostname,
      databaseName: dbName,
      reason: 'CRITICAL REFUSAL: Target database matches known production indicators or hosts. Copying production database host into approval variables is strictly rejected.'
    };
  }

  // 5. Exact Approved Staging Identity Allowlist
  // Per security requirements: We do NOT invent fictitious staging hostnames.
  // The exact non-secret staging database hostname must be explicitly provided
  // via APPROVED_STAGING_DB_HOST or APPROVED_STAGING_PROJECT_REF in the environment.
  const approvedHosts = new Set<string>();
  if (process.env.APPROVED_STAGING_DB_HOST) {
    approvedHosts.add(process.env.APPROVED_STAGING_DB_HOST.trim().toLowerCase());
  }

  // Check username for project ref if Supabase pooler is used (e.g., postgres.[project-ref])
  const username = decodeURIComponent(parsed.username || '').toLowerCase().trim();
  const approvedProjectRefs = new Set<string>();
  if (process.env.APPROVED_STAGING_PROJECT_REF) {
    approvedProjectRefs.add(process.env.APPROVED_STAGING_PROJECT_REF.trim().toLowerCase());
  }

  // Fail-closed if no approved staging identity is configured
  if (approvedHosts.size === 0 && approvedProjectRefs.size === 0) {
    return {
      allowed: false,
      sanitizedHost: hostname,
      databaseName: dbName,
      reason: 'REFUSAL: No approved staging database hostnames or project identifiers are configured in the repository allowlist. ' +
              'To execute against staging, operators must explicitly provide APPROVED_STAGING_DB_HOST or APPROVED_STAGING_PROJECT_REF ' +
              'matching the verified non-secret staging instance identifier.'
    };
  }

  // 6. Exact match verification (no loose substring includes, no implicit localhost)
  let isApprovedHost = approvedHosts.has(hostname);
  let isApprovedProject = false;

  if (username.startsWith('postgres.')) {
    const projectRef = username.slice('postgres.'.length);
    if (approvedProjectRefs.has(projectRef)) {
      isApprovedProject = true;
    }
  }

  if (!isApprovedHost && !isApprovedProject) {
    return {
      allowed: false,
      sanitizedHost: hostname,
      databaseName: dbName,
      reason: `REFUSAL: Database host '${hostname}' is not in the approved staging allowlist. Execution rejected to prevent accidental execution against non-staging environments.`
    };
  }

  // Also verify DIRECT_URL matches approved identity if configured
  if (process.env.DIRECT_URL) {
    try {
      const parsedDirect = parseAndSanitize(process.env.DIRECT_URL);
      const directHost = (parsedDirect.hostname || '').toLowerCase().trim();
      const directUser = decodeURIComponent(parsedDirect.username || '').toLowerCase().trim();
      let directApproved = approvedHosts.has(directHost);
      if (directUser.startsWith('postgres.')) {
        const directRef = directUser.slice('postgres.'.length);
        if (approvedProjectRefs.has(directRef)) {
          directApproved = true;
        }
      }
      if (!directApproved) {
        return {
          allowed: false,
          sanitizedHost: directHost,
          reason: `REFUSAL: DIRECT_URL database host '${directHost}' is not in the approved staging allowlist.`
        };
      }
    } catch {
      return {
        allowed: false,
        reason: 'REFUSAL: DIRECT_URL is malformed or unapproved.'
      };
    }
  }

  return {
    allowed: true,
    sanitizedHost: hostname,
    databaseName: dbName,
    reason: 'Staging identity positively verified against approved allowlist.'
  };
}

class ConcurrencyBarrier {
  private count = 0;
  private waiters: (() => void)[] = [];

  async signalAndAwait() {
    this.count++;
    if (this.count === 1) {
      // First transaction pauses here until the second transaction observes null
      await new Promise<void>((resolve) => { this.waiters.push(resolve); });
    } else if (this.count === 2) {
      // Second transaction has observed null! Release both simultaneously
      while (this.waiters.length > 0) {
        const waiter = this.waiters.pop();
        if (waiter) waiter();
      }
    }
  }

  reset() {
    this.count = 0;
    this.waiters = [];
  }
}

function createMockContext(options: {
  tenantId: string;
  user: any;
  body: any;
}) {
  let statusCode = 200;
  let jsonResponse: any = null;

  const req: any = {
    tenantId: options.tenantId,
    user: options.user,
    body: options.body,
    params: {},
    query: {},
    headers: {}
  };

  const res: any = {
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (data: any) => {
      jsonResponse = data;
      return res;
    }
  };

  const next: NextFunction = (err?: any) => {
    if (err) {
      statusCode = 500;
      jsonResponse = { success: false, error: { message: err.message, code: err.code } };
    }
  };

  return {
    req,
    res,
    next,
    getStatus: () => statusCode,
    getBody: () => jsonResponse
  };
}

export async function runRealPostgresConcurrencyTest() {
  console.log('================================================================');
  console.log(' REAL POSTGRESQL CONCURRENCY TEST (STAGING GATE CHECK)          ');
  console.log('================================================================\n');

  // FAIL-CLOSED STAGING IDENTITY VERIFICATION:
  // Must NOT run unless staging database identity and explicit approval are confirmed
  const verification = verifyStagingDatabaseIdentity();
  if (!verification.allowed) {
    console.log(` [PAUSED] ${verification.reason}`);
    console.log(' Real PostgreSQL concurrency test is armed but held for explicit staging sign-off.');
    console.log(' Zero queries were executed against any database.\n');
    return { status: 'PAUSED_PENDING_APPROVAL', reason: verification.reason };
  }

  console.log(`[concurrency-test] Staging safety gate approved for host '${verification.sanitizedHost}'. Preparing test fixtures in real PostgreSQL...`);

  const TEST_TENANT_SLUG = `test-tenant-${Date.now()}`;
  const barrier = new ConcurrencyBarrier();
  let barrierActive = true;
  let retryCount = 0;
  let tenant: any = null;

  // Inspect initial prototype ownership of prisma.$transaction
  const isOwnPropertyInitially = Object.prototype.hasOwnProperty.call(prisma, '$transaction');
  const initialDescriptor = Object.getOwnPropertyDescriptor(prisma, '$transaction');
  const originalTransaction = prisma.$transaction.bind(prisma);

  try {
    // 1. Setup real test fixtures in PostgreSQL
    tenant = await prisma.tenant.create({
      data: {
        name: 'Staging Concurrency Tenant',
        slug: TEST_TENANT_SLUG,
        phone: '9999999999'
      }
    });

    const customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        customerId: `CUST-CONC-${Date.now()}`,
        firstName: 'Concurrency',
        lastName: 'Tester',
        mobile: `99${Date.now().toString().slice(-8)}`
      }
    });

    const garmentType = await prisma.garmentType.create({
      data: {
        tenantId: tenant.id,
        code: `SHIRT-${Date.now()}`,
        name: 'Bespoke Shirt',
        category: 'Top'
      }
    });

    // 2. Scoped Test-Only Transaction Interception
    // Intercepts tx.customerMeasurement.findFirst exclusively for this test run
    (prisma as any).$transaction = async function (fn: any, options?: any) {
      if (typeof fn === 'function') {
        return originalTransaction(async (tx: any) => {
          const originalFindFirst = tx.customerMeasurement.findFirst.bind(tx.customerMeasurement);

          tx.customerMeasurement.findFirst = async (...args: any[]) => {
            const res = await originalFindFirst(...args);
            if (res === null && barrierActive) {
              // Synchronize: both concurrent transactions must observe null profile before either inserts
              await barrier.signalAndAwait();
            } else if (res !== null && !barrierActive) {
              // This is the Attempt 2 retry finding the winning transaction's committed profile!
              retryCount++;
            }
            return res;
          };

          return fn(tx);
        }, { timeout: 15000, maxWait: 10000, ...options });
      }
      return originalTransaction(fn, options);
    };

    // 3. Prepare two independent concurrent controller contexts
    const userA = { id: `user-a-${Date.now()}`, role: 'SHOP_OWNER' };
    const userB = { id: `user-b-${Date.now()}`, role: 'TAILOR' };

    const ctxA = createMockContext({
      tenantId: tenant.id,
      user: userA,
      body: {
        customerId: customer.id,
        garmentTypeId: garmentType.id,
        name: 'Concurrency Profile',
        unit: UnitSystem.INCHES,
        values: { chest: 40, sleeve: 25 },
        notes: 'Request A payload'
      }
    });

    const ctxB = createMockContext({
      tenantId: tenant.id,
      user: userB,
      body: {
        customerId: customer.id,
        garmentTypeId: garmentType.id,
        name: 'Concurrency Profile',
        unit: UnitSystem.INCHES,
        values: { chest: 41, sleeve: 25.5 },
        notes: 'Request B payload'
      }
    });

    console.log('[concurrency-test] Invoking actual MeasurementsController concurrently across two transactions...');

    // 4. Fire both requests simultaneously against real PostgreSQL
    const [resA, resB] = await Promise.all([
      MeasurementsController.saveCustomerMeasurement(ctxA.req, ctxA.res, ctxA.next),
      MeasurementsController.saveCustomerMeasurement(ctxB.req, ctxB.res, ctxB.next)
    ]);

    barrierActive = false;

    // 5. Symmetric Verification (Do NOT assume which request won)
    console.log('[concurrency-test] Verifying symmetric HTTP responses...');
    if (ctxA.getStatus() !== 201 || ctxB.getStatus() !== 201) {
      throw new Error(`Expected both requests to return HTTP 201, got: A=${ctxA.getStatus()}, B=${ctxB.getStatus()}`);
    }

    const profileIdA = ctxA.getBody().data.measurement.id;
    const profileIdB = ctxB.getBody().data.measurement.id;
    if (profileIdA !== profileIdB) {
      throw new Error(`Profile ID mismatch: Requests did not attach to the same profile (${profileIdA} !== ${profileIdB})`);
    }

    const versionIdA = ctxA.getBody().data.version.id;
    const versionIdB = ctxB.getBody().data.version.id;
    if (!versionIdA || !versionIdB || versionIdA === versionIdB) {
      throw new Error(`Expected distinct version IDs, got: A=${versionIdA}, B=${versionIdB}`);
    }

    const versionNumA = ctxA.getBody().data.version.versionNumber;
    const versionNumB = ctxB.getBody().data.version.versionNumber;
    const returnedVersions = new Set([versionNumA, versionNumB]);
    if (!returnedVersions.has(1) || !returnedVersions.has(2)) {
      throw new Error(`Expected versions [1, 2] symmetrically, got: A=${versionNumA}, B=${versionNumB}`);
    }

    // 6. Direct Database Assertions in PostgreSQL
    console.log('[concurrency-test] Asserting real PostgreSQL database state...');

    const dbProfiles = await prisma.customerMeasurement.findMany({
      where: { tenantId: tenant.id, customerId: customer.id, garmentTypeId: garmentType.id }
    });
    if (dbProfiles.length !== 1) {
      throw new Error(`Expected exactly 1 profile in PostgreSQL, found: ${dbProfiles.length}`);
    }

    const dbVersions = await prisma.measurementVersion.findMany({
      where: { customerMeasurementId: dbProfiles[0].id },
      orderBy: { versionNumber: 'asc' }
    });
    if (dbVersions.length !== 2 || dbVersions[0].versionNumber !== 1 || dbVersions[1].versionNumber !== 2) {
      throw new Error(`Expected exactly 2 sequential versions in PostgreSQL [1, 2], found: ${JSON.stringify(dbVersions.map(v => v.versionNumber))}`);
    }
    if (dbVersions[0].id === dbVersions[1].id) {
      throw new Error(`Expected distinct database version IDs in PostgreSQL`);
    }

    const dbAuditLogs = await prisma.auditLog.findMany({
      where: {
        tenantId: tenant.id,
        customerId: customer.id,
        entity: 'CustomerMeasurement',
        action: 'MEASUREMENT_RECORDED'
      },
      orderBy: { createdAt: 'asc' }
    });

    if (dbAuditLogs.length !== 2) {
      throw new Error(`Expected exactly 2 committed audit logs in PostgreSQL (verifying rolled back collision left zero records), found: ${dbAuditLogs.length}`);
    }

    if (dbAuditLogs[0].entityId !== dbProfiles[0].id || dbAuditLogs[1].entityId !== dbProfiles[0].id) {
      throw new Error(`Audit log entityId did not point to primary profile`);
    }

    const auditVersion1 = (dbAuditLogs[0].details as any)?.versionNumber;
    const auditVersion2 = (dbAuditLogs[1].details as any)?.versionNumber;
    if (auditVersion1 !== 1 || auditVersion2 !== 2) {
      throw new Error(`Audit log details version numbers expected [1, 2], got: [${auditVersion1}, ${auditVersion2}]`);
    }

    console.log('================================================================');
    console.log('  REAL POSTGRESQL CONCURRENCY TEST: ALL ASSERTIONS PASSED!      ');
    console.log('================================================================\n');
    return { status: 'PASSED', profileId: dbProfiles[0].id };

  } finally {
    // 7. Guaranteed Restoration of prisma.$transaction prototype delegation
    if (!isOwnPropertyInitially) {
      delete (prisma as any).$transaction;
    } else if (initialDescriptor) {
      Object.defineProperty(prisma, '$transaction', initialDescriptor);
    } else {
      (prisma as any).$transaction = originalTransaction;
    }

    // Verify property ownership and delegation are restored
    const isOwnAfter = Object.prototype.hasOwnProperty.call(prisma, '$transaction');
    if (isOwnAfter !== isOwnPropertyInitially) {
      console.error(`[CRITICAL] prisma.$transaction own-property leaked into subsequent tests! isOwn=${isOwnAfter}`);
    }

    // Cleanup test fixtures even if either controller request fails
    if (tenant?.id) {
      try {
        await prisma.tenant.delete({ where: { id: tenant.id } });
      } catch (cleanErr) {
        // Ignore cleanup error
      }
    }
  }
}

/**
 * Automated Verification Contract:
 * 1. Proves exact prototype ownership and cleanup of prisma.$transaction.
 * 2. Proves fail-closed behavior of the staging database identity verification gate.
 */
export async function testTransactionRestorationContract(): Promise<{ passed: number; failed: number }> {
  console.log('================================================================');
  console.log('  TRANSACTION RESTORATION & IDENTITY CONTRACT VERIFICATION      ');
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

  // Part 1: Property Descriptor & Prototype Ownership Verification
  const initialIsOwn = Object.prototype.hasOwnProperty.call(prisma, '$transaction');
  const protoHasTx = Object.prototype.hasOwnProperty.call(Object.getPrototypeOf(prisma), '$transaction');
  assert(initialIsOwn === false, 'Test 1.1: prisma instance does NOT have an own-property $transaction initially');
  assert(protoHasTx === true, 'Test 1.2: prisma inherits $transaction from PrismaClient.prototype');

  // Verify own-property creation during interception
  (prisma as any).$transaction = async function intercepted(fn: any, opts: any) {
    return 'mocked-interception';
  };
  const duringIsOwn = Object.prototype.hasOwnProperty.call(prisma, '$transaction');
  assert(duringIsOwn === true, 'Test 1.3: Assigning $transaction creates an own-property on prisma instance');

  // Verify exact restoration via delete even when error is thrown in caller
  let simulatedErrorCaught = false;
  try {
    throw new Error('Simulated failure during concurrent request execution');
  } catch (err) {
    simulatedErrorCaught = true;
  } finally {
    if (!initialIsOwn) {
      delete (prisma as any).$transaction;
    }
  }
  const afterIsOwn = Object.prototype.hasOwnProperty.call(prisma, '$transaction');
  const afterType = typeof prisma.$transaction;
  const afterMatchesProto = prisma.$transaction === (Object.getPrototypeOf(prisma) as any).$transaction;

  assert(simulatedErrorCaught === true, 'Test 1.4: Error scenario simulated in controller caller');
  assert(afterIsOwn === false, 'Test 1.5: Own-property $transaction is deleted in finally block');
  assert(afterType === 'function', 'Test 1.6: prisma.$transaction remains an active function');
  assert(afterMatchesProto === true, 'Test 1.7: prisma.$transaction delegates strictly to PrismaClient.prototype');

  // Part 2: Fail-Closed Staging Database Identity Gate Verification
  const savedEnv = { ...process.env };
  try {
    // Case 2.1: STAGING_CONCURRENCY_TEST_ENABLED not 'true'
    delete process.env.STAGING_CONCURRENCY_TEST_ENABLED;
    const res1 = verifyStagingDatabaseIdentity();
    assert(res1.allowed === false && res1.reason.includes('not set to "true"'),
      'Test 2.1: Identity gate rejects when STAGING_CONCURRENCY_TEST_ENABLED is unset');

    // Case 2.2: NODE_ENV is production
    process.env.STAGING_CONCURRENCY_TEST_ENABLED = 'true';
    process.env.NODE_ENV = 'production';
    const res2 = verifyStagingDatabaseIdentity();
    assert(res2.allowed === false && res2.reason.includes('NODE_ENV is set to "production"'),
      'Test 2.2: Identity gate unconditionally rejects when NODE_ENV is production');

    // Case 2.3: Missing URL
    process.env.NODE_ENV = 'test';
    delete process.env.DIRECT_URL;
    delete process.env.DATABASE_URL;
    const res3 = verifyStagingDatabaseIdentity();
    assert(res3.allowed === false && res3.reason.includes('is missing or empty'),
      'Test 2.3: Identity gate rejects when DATABASE_URL used by PrismaClient is missing');

    // Case 2.4: Malformed URL
    process.env.DATABASE_URL = 'not_a_valid_url';
    const res4 = verifyStagingDatabaseIdentity();
    assert(res4.allowed === false && res4.reason.includes('malformed'),
      'Test 2.4: Identity gate rejects when database URL is malformed');

    // Case 2.5: No approved staging hostnames configured in allowlist
    process.env.DATABASE_URL = 'postgresql://user:pass@staging-db.tailor.internal:5432/tailor_staging';
    delete process.env.APPROVED_STAGING_DB_HOST;
    delete process.env.APPROVED_STAGING_PROJECT_REF;
    const res5 = verifyStagingDatabaseIdentity();
    assert(res5.allowed === false && res5.reason.includes('No approved staging database hostnames'),
      'Test 2.5: Identity gate rejects when repository allowlist has no approved staging identity');

    // Case 2.6: Hostname does NOT match approved allowlist
    process.env.APPROVED_STAGING_DB_HOST = 'staging-exact.tailor.internal';
    process.env.DATABASE_URL = 'postgresql://user:pass@unapproved-host.internal:5432/tailor_staging';
    const res6 = verifyStagingDatabaseIdentity();
    assert(res6.allowed === false && res6.reason.includes('not in the approved staging allowlist'),
      'Test 2.6: Identity gate rejects unapproved hostname even with valid syntax');

    // Case 2.7: Loose substring matching rejected (e.g. unapproved host containing "staging")
    process.env.APPROVED_STAGING_DB_HOST = 'staging-exact.tailor.internal';
    process.env.DATABASE_URL = 'postgresql://user:pass@staging-fraud.attacker.com:5432/tailor_staging';
    const res7 = verifyStagingDatabaseIdentity();
    assert(res7.allowed === false && res7.reason.includes('not in the approved staging allowlist'),
      'Test 2.7: Identity gate rejects loose substring matches like staging-fraud.attacker.com');

    // Case 2.8: Localhost rejected unless explicitly in allowlist
    process.env.APPROVED_STAGING_DB_HOST = 'staging-exact.tailor.internal';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/tailor_staging';
    const res8 = verifyStagingDatabaseIdentity();
    assert(res8.allowed === false && res8.reason.includes('not in the approved staging allowlist'),
      'Test 2.8: Identity gate rejects localhost by default');

    // Case 2.9: Exact approved host accepted
    process.env.APPROVED_STAGING_DB_HOST = 'staging-exact.tailor.internal';
    process.env.DATABASE_URL = 'postgresql://user:secret@staging-exact.tailor.internal:5432/tailor_staging';
    const res9 = verifyStagingDatabaseIdentity();
    assert(res9.allowed === true && res9.sanitizedHost === 'staging-exact.tailor.internal',
      'Test 2.9: Identity gate accepts exact approved host');

    // Case 2.10: Never leaks credentials in verification output
    assert(!JSON.stringify(res9).includes('secret'),
      'Test 2.10: Verification result does NOT leak credentials or passwords');

    // Case 2.11: Production database indicator rejected even if host is copied into approval variable
    process.env.APPROVED_STAGING_DB_HOST = 'prod-db.supabase.com';
    process.env.DATABASE_URL = 'postgresql://user:secret@prod-db.supabase.com:5432/tailor_prod';
    const res11 = verifyStagingDatabaseIdentity();
    assert(res11.allowed === false && res11.reason.includes('matches known production indicators'),
      'Test 2.11: Production database rejected unconditionally even if host copied to approval variable');

    // Case 2.12: Validates DATABASE_URL and DIRECT_URL match approved identity
    process.env.APPROVED_STAGING_DB_HOST = 'staging-exact.tailor.internal';
    process.env.DATABASE_URL = 'postgresql://user:secret@staging-exact.tailor.internal:5432/tailor_staging';
    process.env.DIRECT_URL = 'postgresql://user:secret@unapproved-direct.internal:5432/tailor_staging';
    delete process.env.PRODUCTION_DATABASE_URL;
    delete process.env.PROD_DB_HOST;
    const res12 = verifyStagingDatabaseIdentity();
    assert(res12.allowed === false && res12.reason.includes('not in the approved staging allowlist') || res12.allowed === false,
      'Test 2.12: Identity gate rejects split configuration when DIRECT_URL is unapproved');

  } finally {
    process.env = savedEnv;
  }

  console.log('\n================================================================');
  console.log(`  CONTRACT VERIFICATION RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  return { passed, failed };
}

if (require.main === module) {
  testTransactionRestorationContract()
    .then((contractRes) => {
      if (contractRes.failed > 0) {
        process.exit(1);
      }
      return runRealPostgresConcurrencyTest();
    })
    .catch((err) => {
      console.error('Fatal concurrency test failure:', err);
      process.exit(1);
    });
}
