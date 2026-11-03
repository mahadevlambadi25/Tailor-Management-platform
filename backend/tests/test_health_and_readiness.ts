import { app } from '../src/app';
import { prisma } from '../src/core/prisma';

function testRequest(method: string, url: string): Promise<{ status: number; body: any; rawText: string }> {
  return new Promise((resolve, reject) => {
    let statusCode = 200;
    let rawText = '';
    const headers: Record<string, any> = {};
    const res: any = {
      statusCode: 200,
      headersSent: false,
      status(code: number) {
        statusCode = code;
        this.statusCode = code;
        return this;
      },
      json(data: any) {
        rawText = JSON.stringify(data);
        resolve({ status: statusCode, body: data, rawText });
      },
      send(data: any) {
        rawText = String(data);
        resolve({ status: statusCode, body: data, rawText });
      },
      setHeader(name: string, value: any) {
        headers[name.toLowerCase()] = value;
        return this;
      },
      getHeader(name: string) {
        return headers[name.toLowerCase()];
      },
      removeHeader(name: string) {
        delete headers[name.toLowerCase()];
      },
      end(data?: any) {
        if (data) rawText = String(data);
        resolve({ status: statusCode, body: rawText, rawText });
      }
    };
    const req: any = {
      method,
      url,
      path: url.split('?')[0],
      query: {},
      headers: { host: 'localhost:5000' },
      get(header: string) { return this.headers[header.toLowerCase()]; }
    };
    app(req, res, (err: any) => {
      if (err) reject(err);
      else resolve({ status: 404, body: null, rawText: 'Not Found' });
    });
  });
}

async function runHealthAndReadinessTests() {
  console.log('================================================================');
  console.log('   HEALTH & READINESS ENDPOINTS AUTOMATED TEST SUITE            ');
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

  // -------------------------------------------------------------------------
  // Phase A.1: Liveness Endpoint (/health, /api/v1/health, /)
  // -------------------------------------------------------------------------
  console.log('[LIVENESS TESTS]');

  // Test 1: /health returns HTTP 200 with status: "ok"
  {
    const { status, body } = await testRequest('GET', '/health');
    assert(status === 200, 'Test 1.1: /health responds with HTTP 200');
    assert(body.status === 'ok', 'Test 1.2: /health body contains status: "ok"');
    assert(typeof body.timestamp === 'string', 'Test 1.3: /health body contains ISO timestamp');
  }

  // Test 2: /api/v1/health returns HTTP 200
  {
    const { status, body } = await testRequest('GET', '/api/v1/health');
    assert(status === 200, 'Test 2.1: /api/v1/health responds with HTTP 200');
    assert(body.status === 'ok', 'Test 2.2: /api/v1/health body contains status: "ok"');
  }

  // Test 3: Root route / returns HTTP 200 (for ALB / root health monitors)
  {
    const { status, body } = await testRequest('GET', '/');
    assert(status === 200, 'Test 3.1: Root / responds with HTTP 200');
    assert(body.status === 'ok', 'Test 3.2: Root / body contains status: "ok"');
  }

  // Test 4: /health does NOT leak database credentials or configuration
  {
    const { rawText } = await testRequest('GET', '/health');
    assert(!rawText.includes('password'), 'Test 4.1: /health does not leak "password" keyword');
    assert(!rawText.includes('postgres://'), 'Test 4.2: /health does not leak connection string');
    assert(!rawText.includes('DATABASE_URL'), 'Test 4.3: /health does not leak raw env var names');
  }

  // -------------------------------------------------------------------------
  // Phase A.2: Readiness Endpoint (/ready, /api/v1/ready)
  // -------------------------------------------------------------------------
  console.log('\n[READINESS TESTS]');

  // Test 5: /ready returns HTTP 200 when database connectivity succeeds
  {
    const originalQueryRaw = prisma.$queryRaw;
    try {
      // Mock successful SELECT 1 query
      (prisma as any).$queryRaw = async () => [{ '?column?': 1 }];

      const { status, body } = await testRequest('GET', '/ready');
      assert(status === 200, 'Test 5.1: /ready responds with HTTP 200 on DB success');
      assert(body.status === 'ready', 'Test 5.2: /ready status is "ready"');
      assert(body.database === 'connected', 'Test 5.3: /ready database is "connected"');
    } finally {
      if (Object.prototype.hasOwnProperty.call(prisma, '$queryRaw')) {
        delete (prisma as any).$queryRaw;
      } else {
        (prisma as any).$queryRaw = originalQueryRaw;
      }
    }
  }

  // Test 6: /ready returns HTTP 503 when database connectivity fails
  {
    const originalQueryRaw = prisma.$queryRaw;
    try {
      // Mock failed database connectivity (e.g. connection refused, network partition)
      (prisma as any).$queryRaw = async () => {
        const err: any = new Error('Connection lost to postgresql://user:super_secret_pw@db.host.internal:5432/prod_db');
        err.code = 'P1001';
        throw err;
      };

      const { status, body } = await testRequest('GET', '/ready');
      assert(status === 503, 'Test 6.1: /ready responds with HTTP 503 on DB error');
      assert(body.status === 'unavailable', 'Test 6.2: /ready status is "unavailable"');
      assert(body.database === 'disconnected', 'Test 6.3: /ready database is "disconnected"');
      assert(body.error === 'Database connectivity check failed', 'Test 6.4: Generic sanitized error returned');
    } finally {
      if (Object.prototype.hasOwnProperty.call(prisma, '$queryRaw')) {
        delete (prisma as any).$queryRaw;
      } else {
        (prisma as any).$queryRaw = originalQueryRaw;
      }
    }
  }

  // Test 7: /ready 503 response never leaks connection strings, passwords, or hostnames
  {
    const originalQueryRaw = prisma.$queryRaw;
    try {
      (prisma as any).$queryRaw = async () => {
        throw new Error('FATAL: password authentication failed for user "postgres_admin" on postgres://secret_pw@aws.internal:5432');
      };

      const { status, rawText } = await testRequest('GET', '/ready');
      assert(status === 503, 'Test 7.1: /ready returns 503 on auth failure');
      assert(!rawText.includes('postgres_admin'), 'Test 7.2: /ready 503 response strips username');
      assert(!rawText.includes('secret_pw'), 'Test 7.3: /ready 503 response strips password');
      assert(!rawText.includes('aws.internal'), 'Test 7.4: /ready 503 response strips internal hostname');
    } finally {
      if (Object.prototype.hasOwnProperty.call(prisma, '$queryRaw')) {
        delete (prisma as any).$queryRaw;
      } else {
        (prisma as any).$queryRaw = originalQueryRaw;
      }
    }
  }

  // Test 8: /api/v1/ready responds properly
  {
    const originalQueryRaw = prisma.$queryRaw;
    try {
      (prisma as any).$queryRaw = async () => [{ '?column?': 1 }];

      const { status, body } = await testRequest('GET', '/api/v1/ready');
      assert(status === 200, 'Test 8.1: /api/v1/ready responds with HTTP 200');
      assert(body.status === 'ready', 'Test 8.2: /api/v1/ready body contains status: "ready"');
    } finally {
      if (Object.prototype.hasOwnProperty.call(prisma, '$queryRaw')) {
        delete (prisma as any).$queryRaw;
      } else {
        (prisma as any).$queryRaw = originalQueryRaw;
      }
    }
  }

  // Test 9: /health remains HTTP 200 even when database is completely down
  {
    const originalQueryRaw = prisma.$queryRaw;
    try {
      (prisma as any).$queryRaw = async () => {
        throw new Error('Database completely offline');
      };

      const liveness = await testRequest('GET', '/health');
      assert(liveness.status === 200, 'Test 9.1: /health remains HTTP 200 when database is down');

      const readiness = await testRequest('GET', '/ready');
      assert(readiness.status === 503, 'Test 9.2: /ready simultaneously reflects 503');
    } finally {
      if (Object.prototype.hasOwnProperty.call(prisma, '$queryRaw')) {
        delete (prisma as any).$queryRaw;
      } else {
        (prisma as any).$queryRaw = originalQueryRaw;
      }
    }
  }

  console.log('\n================================================================');
  console.log(`  HEALTH & READINESS RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runHealthAndReadinessTests().catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });
}

export { runHealthAndReadinessTests };
