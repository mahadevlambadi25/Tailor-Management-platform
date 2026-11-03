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
