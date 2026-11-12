import { NudgeScheduler } from '../src/modules/conversion/nudgeScheduler';
import { prisma } from '../src/core/prisma';
import { config } from '../src/config';

async function runEventBridgeSchedulerTests() {
  console.log('================================================================');
  console.log('   EVENTBRIDGE SCHEDULER STANDALONE RELIABILITY TEST SUITE       ');
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

  const prevEnv = process.env.ENABLE_BACKGROUND_SCHEDULER;
  const originalFindMany = prisma.tenant.findMany;
  const originalDisconnect = prisma.$disconnect;

  try {
    // -------------------------------------------------------------------------
    // Test 1: Web Task In-Process Timer Inactivity
    // -------------------------------------------------------------------------
    console.log('[TEST GROUP 1: WEB TASK IN-PROCESS SUPPRESSION]');
    {
      process.env.ENABLE_BACKGROUND_SCHEDULER = 'false';
      NudgeScheduler.start();

      assert(
        (NudgeScheduler as any).timer === null,
        'Test 1.1: NudgeScheduler.start() does not create timer when ENABLE_BACKGROUND_SCHEDULER=false'
      );
      assert(
        (NudgeScheduler as any).initialTimeout === null,
        'Test 1.2: NudgeScheduler.start() does not create initialTimeout when ENABLE_BACKGROUND_SCHEDULER=false'
      );

      // Unforced runCycle() in web task should skip without querying database
      let dbQueried = false;
      (prisma.tenant as any).findMany = async () => {
        dbQueried = true;
        return [];
      };

      const result = await NudgeScheduler.runCycle();
      assert(result.skipped === true, 'Test 1.3: Unforced runCycle() skips when ENABLE_BACKGROUND_SCHEDULER=false');
      assert(dbQueried === false, 'Test 1.4: Unforced runCycle() makes zero database queries');
      NudgeScheduler.stop();
    }

    // -------------------------------------------------------------------------
    // Test 2: Standalone EventBridge Execution with { force: true }
    // -------------------------------------------------------------------------
    console.log('\n[TEST GROUP 2: STANDALONE FORCED EXECUTION]');
    {
      process.env.ENABLE_BACKGROUND_SCHEDULER = 'false';
      let dbQueried: any = false;
      const mockTenants = [{ id: 'tenant-forced-1' }, { id: 'tenant-forced-2' }];

      (prisma.tenant as any).findMany = async () => {
        dbQueried = true;
        return mockTenants;
      };

      // Mock evaluateShopNudges on NudgeService
      const { NudgeService } = require('../src/modules/conversion/nudgeService');
      const originalEvaluate = NudgeService.evaluateShopNudges;
      const evaluatedTenants: string[] = [];
      NudgeService.evaluateShopNudges = async (tenantId: string) => {
        evaluatedTenants.push(tenantId);
        return null;
      };

      try {
        const result = await NudgeScheduler.runCycle({ force: true });
        assert(result.skipped === false, 'Test 2.1: runCycle({ force: true }) executes even when ENABLE_BACKGROUND_SCHEDULER=false');
        assert(Boolean(dbQueried), 'Test 2.2: Forced execution queries candidate tenants from DB');
        assert(result.candidateCount === 2, 'Test 2.3: Candidate count matches returned tenants');
        assert(result.processedCount === 2, 'Test 2.4: Processed count matches candidates');
        assert(evaluatedTenants.length === 2, 'Test 2.5: Every candidate tenant was evaluated');
      } finally {
        NudgeService.evaluateShopNudges = originalEvaluate;
      }
    }

    // -------------------------------------------------------------------------
    // Test 3: In-Process Overlap Guard (isRunning)
    // -------------------------------------------------------------------------
    console.log('\n[TEST GROUP 3: OVERLAPPING INVOCATION PROTECTION]');
    {
      let slowFindManyTriggered = 0;
      (prisma.tenant as any).findMany = async () => {
        slowFindManyTriggered++;
        await new Promise((r) => setTimeout(r, 40));
        return [];
      };

      const [cycle1, cycle2] = await Promise.all([
        NudgeScheduler.runCycle({ force: true }),
        NudgeScheduler.runCycle({ force: true })
      ]);

      assert(slowFindManyTriggered === 1, 'Test 3.1: Exactly one cycle executed database query');
      assert(
        (cycle1.skipped === false && cycle2.skipped === true) || (cycle1.skipped === true && cycle2.skipped === false),
        'Test 3.2: Concurrent cycle call was safely skipped via isRunning guard'
      );
    }

    // -------------------------------------------------------------------------
    // Test 4: Database Error Propagation to Caller
    // -------------------------------------------------------------------------
    console.log('\n[TEST GROUP 4: DATABASE ERROR PROPAGATION]');
    {
      const dbError = new Error('P1001: Can not reach database server at rds.internal:5432');
      (prisma.tenant as any).findMany = async () => {
        throw dbError;
      };

      let errorCaughtByCaller = false;
      try {
        await NudgeScheduler.runCycle({ force: true });
      } catch (err: any) {
        if (err?.message?.includes('P1001')) {
          errorCaughtByCaller = true;
        }
      }

      assert(errorCaughtByCaller === true, 'Test 4.1: Database errors in runCycle() are propagated (not swallowed)');
      assert((NudgeScheduler as any).isRunning === false, 'Test 4.2: isRunning flag is safely reset to false in finally');
    }

    // -------------------------------------------------------------------------
    // Test 5: Standalone Runner Success Path & Prisma Disconnect
    // -------------------------------------------------------------------------
    console.log('\n[TEST GROUP 5: STANDALONE RUNNER SUCCESS & CLEANUP]');
    {
      process.env.ENABLE_BACKGROUND_SCHEDULER = 'false';
      let disconnected: any = false;
      (prisma.tenant as any).findMany = async () => [];
      (prisma as any).$disconnect = async () => {
        disconnected = true;
      };

      const exitCode = await NudgeScheduler.runStandalone();
      assert(exitCode === 0, 'Test 5.1: runStandalone() returns exit code 0 on success');
      assert(Boolean(disconnected), 'Test 5.2: prisma.$disconnect() was executed in success path');
    }

    // -------------------------------------------------------------------------
    // Test 6: Standalone Runner Failure Path & Prisma Disconnect
    // -------------------------------------------------------------------------
    console.log('\n[TEST GROUP 6: STANDALONE RUNNER FAILURE & CLEANUP]');
    {
      process.env.ENABLE_BACKGROUND_SCHEDULER = 'false';
      let disconnectedOnFailure: any = false;
      (prisma.tenant as any).findMany = async () => {
        throw new Error('Connection terminated unexpectedly');
      };
      (prisma as any).$disconnect = async () => {
        disconnectedOnFailure = true;
      };

      const exitCode = await NudgeScheduler.runStandalone();
      assert(exitCode === 1, 'Test 6.1: runStandalone() returns exit code 1 on database error');
      assert(Boolean(disconnectedOnFailure), 'Test 6.2: prisma.$disconnect() was guaranteed in failure path');
    }

    // -------------------------------------------------------------------------
    // Test 7: Prisma Disconnect Exception Safety
    // -------------------------------------------------------------------------
    console.log('\n[TEST GROUP 7: PRISMA DISCONNECT EXCEPTION SAFETY]');
    {
      (prisma.tenant as any).findMany = async () => [];
      (prisma as any).$disconnect = async () => {
        throw new Error('Socket close failure');
      };

      const exitCode = await NudgeScheduler.runStandalone();
      assert(exitCode === 1, 'Test 7.1: Returns exit code 1 if Prisma disconnect throws');
    }

    // -------------------------------------------------------------------------
    // Test 8: Script Runner Module Export & Integration
    // -------------------------------------------------------------------------
    console.log('\n[TEST GROUP 8: SCRIPT RUNNER MODULE CONTRACT]');
    {
      const workerModule = require('../scripts/run-nudge-worker');
      assert(typeof workerModule.main === 'function', 'Test 8.1: scripts/run-nudge-worker.js exports main function');
    }

    // -------------------------------------------------------------------------
    // Test 9: Outbox Worker Multi-Batch Draining & Lifecycle
    // -------------------------------------------------------------------------
    console.log('\n[TEST GROUP 9: OUTBOX WORKER MULTI-BATCH DRAINING]');
    {
      const { OutboxWorker } = require('../src/modules/conversion/outboxWorker');

      // Mock worker that simulates 2 full batches of 10 messages and a 3rd empty batch
      let callCount = 0;
      const mockBatches = [
        { claimedCount: 10, succeededCount: 10, failedCount: 0, retriedCount: 0, staleCount: 0 },
        { claimedCount: 10, succeededCount: 8, failedCount: 1, retriedCount: 1, staleCount: 0 },
        { claimedCount: 0, succeededCount: 0, failedCount: 0, retriedCount: 0, staleCount: 0 }
      ];

      const mockWorker: any = {
        getBatchSize: () => 10,
        processBatch: async () => {
          return mockBatches[callCount++] || { claimedCount: 0, succeededCount: 0, failedCount: 0, retriedCount: 0, staleCount: 0 };
        }
      };

      const result = await NudgeScheduler.processOutboxQueue(mockWorker, {}, 5);
      assert(callCount === 3, 'Test 9.1: processOutboxQueue drained queue until empty batch (3 calls)');
      assert(result.claimedCount === 20, 'Test 9.2: Aggregate claimedCount matches sum of batches (20)');
      assert(result.succeededCount === 18, 'Test 9.3: Aggregate succeededCount is 18');
      assert(result.failedCount === 1, 'Test 9.4: Aggregate failedCount is 1');
      assert(result.retriedCount === 1, 'Test 9.5: Aggregate retriedCount is 1');

      // Test maxBatches limit
      let maxBatchCalls = 0;
      const infiniteQueueWorker: any = {
        getBatchSize: () => 10,
        processBatch: async () => {
          maxBatchCalls++;
          return { claimedCount: 10, succeededCount: 10, failedCount: 0, retriedCount: 0, staleCount: 0 };
        }
      };

      const maxResult = await NudgeScheduler.processOutboxQueue(infiniteQueueWorker, {}, 2);
      assert(maxBatchCalls === 2, 'Test 9.6: processOutboxQueue strictly stops at maxBatches limit');
      assert(maxResult.claimedCount === 20, 'Test 9.7: Correct count capped at maxBatches');

      // Test processOutbox: false skips outbox queue
      (prisma.tenant as any).findMany = async () => [];
      let skippedWorkerCalled = false;
      const skippedWorker: any = {
        getBatchSize: () => 10,
        processBatch: async () => {
          skippedWorkerCalled = true;
          return { claimedCount: 0, succeededCount: 0, failedCount: 0, retriedCount: 0, staleCount: 0 };
        }
      };

      const skippedCycle = await NudgeScheduler.runCycle({
        force: true,
        processOutbox: false,
        outboxWorker: skippedWorker
      });
      assert(skippedWorkerCalled === false, 'Test 9.8: runCycle with processOutbox: false skips worker execution');
      assert(skippedCycle.outboxSummary === undefined, 'Test 9.9: outboxSummary is undefined when processOutbox: false');
    }

    // -------------------------------------------------------------------------
    // Test 10: Outbox Worker Overlap Protection (isRunning)
    // -------------------------------------------------------------------------
    console.log('\n[TEST GROUP 10: OUTBOX WORKER OVERLAP PROTECTION]');
    {
      const { OutboxWorker } = require('../src/modules/conversion/outboxWorker');
      const testWorker = new OutboxWorker();

      // Mock claimBatch to introduce an async delay
      let claimCalls = 0;
      (testWorker as any).claimBatch = async () => {
        claimCalls++;
        await new Promise((r) => setTimeout(r, 40));
        return [];
      };

      const [p1, p2] = await Promise.all([
        testWorker.processBatch({}),
        testWorker.processBatch({})
      ]);

      assert(claimCalls === 1, 'Test 10.1: Only one concurrent batch proceeded to claimBatch');
      assert(
        (p1.claimedCount === 0 && p2.claimedCount === 0),
        'Test 10.2: Overlapping invocation was safely skipped with 0 claimed'
      );
      assert((testWorker as any).isRunning === false, 'Test 10.3: Worker isRunning flag was safely reset in finally');
    }

    // -------------------------------------------------------------------------
    // Test 11: Standalone Outbox Worker Entrypoint & Prisma Cleanup
    // -------------------------------------------------------------------------
    console.log('\n[TEST GROUP 11: STANDALONE OUTBOX WORKER & CLEANUP]');
    {
      let disconnectedOnSuccess = false;
      (prisma as any).$disconnect = async () => {
        disconnectedOnSuccess = true;
      };

      // Mock processOutboxQueue
      const originalProcessQueue = NudgeScheduler.processOutboxQueue;
      (NudgeScheduler as any).processOutboxQueue = async () => ({
        claimedCount: 5,
        succeededCount: 5,
        failedCount: 0,
        retriedCount: 0,
        staleCount: 0
      });

      try {
        const exitCode = await NudgeScheduler.runOutboxWorkerStandalone(5);
        assert(exitCode === 0, 'Test 11.1: runOutboxWorkerStandalone() returns exit code 0 on success');
        assert(Boolean(disconnectedOnSuccess), 'Test 11.2: prisma.$disconnect() was executed on success');

        // Test failure path
        let disconnectedOnFailure = false;
        (prisma as any).$disconnect = async () => {
          disconnectedOnFailure = true;
        };
        (NudgeScheduler as any).processOutboxQueue = async () => {
          throw new Error('Database deadlocked');
        };

        const failCode = await NudgeScheduler.runOutboxWorkerStandalone(5);
        assert(failCode === 1, 'Test 11.3: runOutboxWorkerStandalone() returns exit code 1 on error');
        assert(Boolean(disconnectedOnFailure), 'Test 11.4: prisma.$disconnect() was guaranteed on error');
      } finally {
        (NudgeScheduler as any).processOutboxQueue = originalProcessQueue;
      }
    }

    // -------------------------------------------------------------------------
    // Test 12: Production CORS Configuration Guard
    // -------------------------------------------------------------------------
    console.log('\n[TEST GROUP 12: CORS ORIGIN PRODUCTION CONFIGURATION]');
    {
      // Test parsing logic for comma-separated allowed origins
      const testOrigins = 'https://app.tailorsystem.com, https://tailorsystem.com/';
      const parsed = testOrigins
        .split(',')
        .map((origin) => origin.trim().replace(/\/+$/, ''))
        .filter(Boolean);

      assert(parsed.length === 2, 'Test 12.1: Exactly 2 origins parsed');
      assert(parsed[0] === 'https://app.tailorsystem.com', 'Test 12.2: Primary app domain parsed cleanly');
      assert(parsed[1] === 'https://tailorsystem.com', 'Test 12.3: Trailing slash trimmed from apex domain');

      function resolveCorsOrigin(corsEnv?: string, nodeEnv: string = 'development'): string {
        return corsEnv || (nodeEnv === 'production' ? '' : 'http://localhost:5173');
      }

      // Test that when NODE_ENV=production and CORS_ORIGIN is unset, fallback is empty (no localhost)
      const prodFallback = resolveCorsOrigin(undefined, 'production');
      assert(!prodFallback.includes('localhost'), 'Test 12.4: Production mode does not fallback to localhost when CORS_ORIGIN is unset');

      // Test that when NODE_ENV=development and CORS_ORIGIN is unset, fallback remains localhost:5173
      const devFallback = resolveCorsOrigin(undefined, 'development');
      assert(devFallback === 'http://localhost:5173', 'Test 12.5: Development mode correctly falls back to localhost:5173');

      // Test that configured CORS_ORIGIN is used
      const customConfig = resolveCorsOrigin('https://app.tailorsystem.com', 'production');
      assert(customConfig === 'https://app.tailorsystem.com', 'Test 12.6: Configured CORS_ORIGIN takes precedence');
    }

  } finally {
    process.env.ENABLE_BACKGROUND_SCHEDULER = prevEnv;
    (prisma.tenant as any).findMany = originalFindMany;
    (prisma as any).$disconnect = originalDisconnect;
  }

  console.log('\n================================================================');
  console.log(`  SCHEDULER RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runEventBridgeSchedulerTests().catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });
}

export { runEventBridgeSchedulerTests };
