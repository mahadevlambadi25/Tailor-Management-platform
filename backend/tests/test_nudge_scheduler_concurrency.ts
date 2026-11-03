import { NudgeService } from '../src/modules/conversion/nudgeService';
import { NudgeScheduler } from '../src/modules/conversion/nudgeScheduler';
import { MessageSender } from '../src/modules/conversion/messagingService';
import { prisma } from '../src/core/prisma';
import { config } from '../src/config';

async function runNudgeConcurrencyTests() {
  console.log('================================================================');
  console.log('   NUDGESCHEDULER MULTI-TASK CONCURRENCY TEST SUITE             ');
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
  // Test 1: Concurrency Idempotency — Concurrent Tasks Evaluating Same Shop
  // -------------------------------------------------------------------------
  console.log('[TEST GROUP 1: CONCURRENT NUDGE DISPATCH IDEMPOTENCY]');
  {
    const originalTransaction = prisma.$transaction;
    const originalTenantFindUnique = prisma.tenant.findUnique;
    const originalNudgeLogFindFirst = prisma.nudgeLog.findFirst;
    const originalCustomerCount = prisma.customer.count;
    const originalOrderCount = prisma.order.count;
    const originalUserCount = prisma.user.count;

    const testShopId = 'shop-concurrent-uuid-1';
    let outboxCreatedCount = 0;
    let nudgeLogCreatedCount = 0;
    const createdKeys = new Set<string>();

    try {
      // Mock tenant in trial
      (prisma.tenant as any).findUnique = async () => ({
        id: testShopId,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago (qualifies for nudge_1h)
        phone: '919876543210',
        subscription: { status: 'TRIAL', trialEnd: new Date(Date.now() + 14 * 86400000) },
        users: [{ name: 'Master Tailor', role: 'SHOP_OWNER', phone: '919876543210' }]
      });

      // No recent nudge in the last 24h
      (prisma.nudgeLog as any).findFirst = async () => null;
      (prisma.customer as any).count = async () => 0;
      (prisma.order as any).count = async () => 0;
      (prisma.user as any).count = async () => 0;

      // Mock transaction with simulated concurrency race
      (prisma as any).$transaction = async (callback: any) => {
        const mockTx: any = {
          $queryRaw: async () => [{ id: testShopId }], // Row lock
          tenant: {
            findUnique: async () => ({
              id: testShopId,
              subscription: { status: 'TRIAL' }
            })
          },
          nudgeLog: {
            findFirst: async () => null,
            findUnique: async ({ where }: any) => {
              if (createdKeys.has(where.shopId_key.key)) {
                return { id: 'log-1', key: where.shopId_key.key };
              }
              return null;
            },
            create: async ({ data }: any) => {
              if (createdKeys.has(data.key)) {
                const err: any = new Error('Unique constraint failed on the fields: (`shopId`,`key`)');
                err.code = 'P2002';
                throw err;
              }
              createdKeys.add(data.key);
              nudgeLogCreatedCount++;
              return { id: `log-${nudgeLogCreatedCount}`, ...data };
            }
          },
          outboxMessage: {
            create: async ({ data }: any) => {
              outboxCreatedCount++;
              return { id: `outbox-${outboxCreatedCount}`, ...data };
            }
          }
        };
        return await callback(mockTx);
      };

      // Launch two concurrent evaluations simultaneously (as happens in ECS rolling deploy)
      const [res1, res2] = await Promise.all([
        NudgeService.evaluateShopNudges(testShopId),
        NudgeService.evaluateShopNudges(testShopId)
      ]);

      assert(
        (res1 === 'nudge_1h' && res2 === null) || (res2 === 'nudge_1h' && res1 === null),
        'Test 1.1: Exactly one concurrent task dispatches nudge; second task receives null'
      );
      assert(nudgeLogCreatedCount === 1, 'Test 1.2: Exactly one NudgeLog record created');
      assert(outboxCreatedCount === 1, 'Test 1.3: Exactly one OutboxMessage created (zero duplicate messages)');
    } finally {
      (prisma as any).$transaction = originalTransaction;
      (prisma.tenant as any).findUnique = originalTenantFindUnique;
      (prisma.nudgeLog as any).findFirst = originalNudgeLogFindFirst;
      (prisma.customer as any).count = originalCustomerCount;
      (prisma.order as any).count = originalOrderCount;
      (prisma.user as any).count = originalUserCount;
    }
  }

  // -------------------------------------------------------------------------
  // Test 2: Daily Rate Limit — Maximum One Nudge Per Calendar Day
  // -------------------------------------------------------------------------
  console.log('\n[TEST GROUP 2: DAILY RATE LIMIT]');
  {
    const originalTenantFindUnique = prisma.tenant.findUnique;
    const originalNudgeLogFindFirst = prisma.nudgeLog.findFirst;

    try {
      const testShopId = 'shop-rate-limit-uuid';
      (prisma.tenant as any).findUnique = async () => ({
        id: testShopId,
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        subscription: { status: 'TRIAL' },
        users: [{ name: 'Tailor', role: 'SHOP_OWNER' }]
      });

      // Mock that a nudge was already sent 3 hours ago
      (prisma.nudgeLog as any).findFirst = async () => ({
        id: 'recent-nudge-id',
        shopId: testShopId,
        sentAt: new Date(Date.now() - 3 * 60 * 60 * 1000)
      });

      const res = await NudgeService.evaluateShopNudges(testShopId);
      assert(res === null, 'Test 2.1: evaluateShopNudges rejects dispatch when a nudge was sent in past 24h');
    } finally {
      (prisma.tenant as any).findUnique = originalTenantFindUnique;
      (prisma.nudgeLog as any).findFirst = originalNudgeLogFindFirst;
    }
  }

  // -------------------------------------------------------------------------
  // Test 3: Active Subscription — Immediately Halt All Nudges
  // -------------------------------------------------------------------------
  console.log('\n[TEST GROUP 3: ACTIVE SUBSCRIPTION CEASEFIRE]');
  {
    const originalTenantFindUnique = prisma.tenant.findUnique;

    try {
      const testShopId = 'shop-paid-uuid';
      (prisma.tenant as any).findUnique = async () => ({
        id: testShopId,
        subscription: { status: 'ACTIVE' },
        users: [{ name: 'Paid Customer', role: 'SHOP_OWNER' }]
      });

      const res = await NudgeService.evaluateShopNudges(testShopId);
      assert(res === null, 'Test 3.1: evaluateShopNudges immediately returns null for ACTIVE subscriptions');

      const recoveryRes = await NudgeService.sendPaymentRecovery(testShopId, '1h');
      assert(recoveryRes === false, 'Test 3.2: sendPaymentRecovery immediately returns false for ACTIVE subscriptions');
    } finally {
      (prisma.tenant as any).findUnique = originalTenantFindUnique;
    }
  }

  // -------------------------------------------------------------------------
  // Test 4: Scheduler In-Process Overlap Guard (isRunning)
  // -------------------------------------------------------------------------
  console.log('\n[TEST GROUP 4: SCHEDULER IN-PROCESS OVERLAP GUARD]');
  {
    const originalTenantFindMany = prisma.tenant.findMany;
    let cyclesStarted = 0;

    try {
      (prisma.tenant as any).findMany = async () => {
        cyclesStarted++;
        // Simulate a long-running cycle (e.g. 50ms)
        await new Promise((r) => setTimeout(r, 50));
        return [];
      };

      // Fire two cycles simultaneously on the same process
      const cycle1 = NudgeScheduler.runCycle();
      const cycle2 = NudgeScheduler.runCycle();

      await Promise.all([cycle1, cycle2]);

      assert(cyclesStarted === 1, 'Test 4.1: Overlapping in-process scheduler cycle is skipped (isRunning guard)');
    } finally {
      (prisma.tenant as any).findMany = originalTenantFindMany;
    }
  }

  // -------------------------------------------------------------------------
  // Test 5: Scheduler Disabled via ENABLE_BACKGROUND_SCHEDULER=false
  // -------------------------------------------------------------------------
  console.log('\n[TEST GROUP 5: ENABLE_BACKGROUND_SCHEDULER ENVIRONMENT FLAG]');
  {
    const prevEnv = process.env.ENABLE_BACKGROUND_SCHEDULER;
    try {
      process.env.ENABLE_BACKGROUND_SCHEDULER = 'false';
      NudgeScheduler.start();

      // Check private timer field via reflection/state
      assert(
        (NudgeScheduler as any).timer === null,
        'Test 5.1: NudgeScheduler.start() does not create timer when ENABLE_BACKGROUND_SCHEDULER=false'
      );
      assert(
        (NudgeScheduler as any).initialTimeout === null,
        'Test 5.2: NudgeScheduler.start() does not create initialTimeout when ENABLE_BACKGROUND_SCHEDULER=false'
      );
    } finally {
      process.env.ENABLE_BACKGROUND_SCHEDULER = prevEnv;
      NudgeScheduler.stop();
    }
  }

  // -------------------------------------------------------------------------
  // Test 6: MessageSender STUB Guarantee (Never sends real external messages)
  // -------------------------------------------------------------------------
  console.log('\n[TEST GROUP 6: MESSAGING STUB GUARANTEE]');
  {
    const originalOutboxCreate = prisma.outboxMessage.create;
    let outboxStatus = '';

    try {
      (prisma.outboxMessage as any).create = async ({ data }: any) => {
        outboxStatus = data.status;
        return { id: 'outbox-msg-1', ...data };
      };

      const result = await MessageSender.send({
        to: '+919999999999',
        templateKey: 'nudge_1h',
        vars: { firstName: 'Ravi', link: 'http://localhost:5173/dashboard' },
        tenantId: 'tenant-test'
      });

      assert(outboxStatus === 'STUBBED', 'Test 6.1: Message record created with status="STUBBED"');
      assert(result.waLink.startsWith('https://wa.me/919999999999'), 'Test 6.2: WhatsApp deep link rendered without network call');
    } finally {
      (prisma.outboxMessage as any).create = originalOutboxCreate;
    }
  }

  console.log('\n================================================================');
  console.log(`  CONCURRENCY RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runNudgeConcurrencyTests().catch((err) => {
    console.error('Concurrency test suite failed:', err);
    process.exit(1);
  });
}

export { runNudgeConcurrencyTests };
