import { prisma } from '../../core/prisma';
import { logger } from '../../core/logger';
import { config } from '../../config';
import { NudgeService } from './nudgeService';
import { OutboxWorker, ProcessBatchResult } from './outboxWorker';

export interface RunCycleOptions {
  force?: boolean;
  processOutbox?: boolean;
  outboxWorker?: OutboxWorker;
  maxOutboxBatches?: number;
  client?: any;
}

export interface RunCycleResult {
  processedCount: number;
  candidateCount: number;
  skipped: boolean;
  outboxSummary?: ProcessBatchResult;
}

export class NudgeScheduler {
  private static timer: NodeJS.Timeout | null = null;
  private static initialTimeout: NodeJS.Timeout | null = null;
  private static isRunning = false;

  static start() {
    if (!config.conversionV1) {
      logger.info('[NudgeScheduler] CONVERSION_V1 is disabled; scheduled runner inactive');
      return;
    }

    if (process.env.ENABLE_BACKGROUND_SCHEDULER === 'false') {
      logger.info('[NudgeScheduler] ENABLE_BACKGROUND_SCHEDULER is false; in-process scheduler inactive (recommended for multi-task ECS)');
      return;
    }

    if (this.timer || this.initialTimeout) {
      this.stop();
    }

    logger.info('[NudgeScheduler] Starting conversion trial nudge scheduler');

    // Run scheduled cycle every 30 minutes
    const intervalMs = 30 * 60 * 1000;
    this.timer = setInterval(async () => {
      try {
        await this.runCycle();
      } catch (err: any) {
        logger.error(`[NudgeScheduler] Background interval cycle error: ${err?.message}`, err);
      }
    }, intervalMs);

    // Run an initial safe cycle 10 seconds after server bootstrap
    this.initialTimeout = setTimeout(async () => {
      try {
        await this.runCycle();
      } catch (err: any) {
        logger.error(`[NudgeScheduler] Initial background cycle error: ${err?.message}`, err);
      }
    }, 10000);
  }

  /**
   * Processes pending outbox messages in batches until the queue is drained
   * or maxBatches is reached.
   * - Claims rows via FOR UPDATE SKIP LOCKED with per-row UUID lease tokens
   * - Stale workers are rejected on update to prevent split-brain overwrites
   * - Provider network requests execute outside open DB transactions
   * - Retries with exponential backoff on retryable provider errors
   */
  static async processOutboxQueue(
    worker?: OutboxWorker,
    client: any = prisma,
    maxBatches: number = 10
  ): Promise<ProcessBatchResult> {
    const activeWorker = worker || new OutboxWorker();
    const aggregateResult: ProcessBatchResult = {
      claimedCount: 0,
      succeededCount: 0,
      failedCount: 0,
      retriedCount: 0,
      staleCount: 0
    };

    let batchesProcessed = 0;
    const batchSizeLimit = typeof (activeWorker as any).getBatchSize === 'function'
      ? (activeWorker as any).getBatchSize()
      : 10;

    while (batchesProcessed < maxBatches) {
      try {
        const batchResult = await activeWorker.processBatch(client);
        aggregateResult.claimedCount += batchResult.claimedCount;
        aggregateResult.succeededCount += batchResult.succeededCount;
        aggregateResult.failedCount += batchResult.failedCount;
        aggregateResult.retriedCount += batchResult.retriedCount;
        aggregateResult.staleCount += batchResult.staleCount;

        batchesProcessed++;

        // If no messages or fewer messages than batchSize were claimed, queue is drained
        if (batchResult.claimedCount === 0 || batchResult.claimedCount < batchSizeLimit) {
          break;
        }
      } catch (err: any) {
        logger.error(`[NudgeScheduler] Outbox queue batch execution error: ${err?.message || err}`, err);
        // Break out of draining loop so remaining messages remain safely PENDING for next run
        break;
      }
    }

    if (aggregateResult.claimedCount > 0) {
      logger.info(
        `[NudgeScheduler] Outbox queue processed ${batchesProcessed} batch(es): ` +
        `claimed=${aggregateResult.claimedCount}, succeeded=${aggregateResult.succeededCount}, ` +
        `retried=${aggregateResult.retriedCount}, failed=${aggregateResult.failedCount}, stale=${aggregateResult.staleCount}`
      );
    }

    return aggregateResult;
  }

  static async runCycle(options?: RunCycleOptions): Promise<RunCycleResult> {
    if (!config.conversionV1) {
      return { processedCount: 0, candidateCount: 0, skipped: true };
    }

    // In-process cycle is bypassed when background scheduler is disabled unless explicitly forced (e.g. standalone EventBridge task)
    if (process.env.ENABLE_BACKGROUND_SCHEDULER === 'false' && !options?.force) {
      logger.info('[NudgeScheduler] In-process runCycle skipped because ENABLE_BACKGROUND_SCHEDULER=false');
      return { processedCount: 0, candidateCount: 0, skipped: true };
    }

    if (this.isRunning) {
      logger.warn('[NudgeScheduler] Cycle already in progress; skipping overlapping run');
      return { processedCount: 0, candidateCount: 0, skipped: true };
    }

    this.isRunning = true;

    try {
      const candidateTenants = await prisma.tenant.findMany({
        where: {
          subscription: {
            status: { in: ['TRIAL', 'PENDING'] }
          }
        },
        select: { id: true }
      });

      let processedCount = 0;
      for (const tenant of candidateTenants) {
        await NudgeService.evaluateShopNudges(tenant.id);
        processedCount++;
      }

      logger.info(`[NudgeScheduler] Completed nudge cycle for ${candidateTenants.length} candidate tenant(s)`);

      // Drain pending outbox queue
      let outboxSummary: ProcessBatchResult | undefined;
      if (options?.processOutbox !== false) {
        try {
          outboxSummary = await this.processOutboxQueue(
            options?.outboxWorker,
            options?.client || prisma,
            options?.maxOutboxBatches
          );
        } catch (outboxErr: any) {
          logger.error(`[NudgeScheduler] Non-fatal error processing outbox queue in runCycle: ${outboxErr?.message || outboxErr}`, outboxErr);
        }
      }

      return {
        processedCount,
        candidateCount: candidateTenants.length,
        skipped: false,
        outboxSummary
      };
    } catch (err: any) {
      logger.error(`[NudgeScheduler] Error executing scheduled nudge cycle: ${err?.message}`, err);
      throw err;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Standalone entrypoint for Amazon EventBridge scheduled one-off tasks.
   * - Forces cycle execution even when ENABLE_BACKGROUND_SCHEDULER=false
   * - Catches errors, logs details, and returns exit code (0 = success, 1 = failure)
   * - Guarantees Prisma disconnection completes before returning
   */
  static async runStandalone(): Promise<number> {
    let exitCode = 0;
    logger.info('[NudgeScheduler] Executing standalone EventBridge nudge cycle...');
    try {
      const result = await this.runCycle({ force: true });
      logger.info(
        `[NudgeScheduler] Standalone cycle completed: processed ${result.processedCount}/${result.candidateCount} tenants (skipped: ${result.skipped})` +
        (result.outboxSummary ? `, outbox claimed=${result.outboxSummary.claimedCount}, succeeded=${result.outboxSummary.succeededCount}` : '')
      );
    } catch (err: any) {
      logger.error(`[NudgeScheduler] Standalone cycle failed with error: ${err?.message || err}`, err);
      exitCode = 1;
    } finally {
      logger.info('[NudgeScheduler] Performing Prisma disconnect...');
      try {
        await prisma.$disconnect();
        logger.info('[NudgeScheduler] Prisma disconnected cleanly.');
      } catch (dcErr: any) {
        logger.error(`[NudgeScheduler] Error disconnecting Prisma Client: ${dcErr?.message || dcErr}`);
        exitCode = 1;
      }
    }
    return exitCode;
  }

  /**
   * Standalone entrypoint for dedicated Outbox Worker draining runs.
   * - Processes outbox batches until empty or maxBatches reached
   * - Guarantees Prisma disconnection on exit
   */
  static async runOutboxWorkerStandalone(maxBatches: number = 20): Promise<number> {
    let exitCode = 0;
    logger.info('[NudgeScheduler] Executing standalone Outbox Worker draining cycle...');
    try {
      const summary = await this.processOutboxQueue(undefined, prisma, maxBatches);
      logger.info(
        `[NudgeScheduler] Standalone outbox cycle completed: claimed=${summary.claimedCount}, ` +
        `succeeded=${summary.succeededCount}, retried=${summary.retriedCount}, failed=${summary.failedCount}`
      );
    } catch (err: any) {
      logger.error(`[NudgeScheduler] Standalone outbox cycle failed with error: ${err?.message || err}`, err);
      exitCode = 1;
    } finally {
      logger.info('[NudgeScheduler] Performing Prisma disconnect...');
      try {
        await prisma.$disconnect();
        logger.info('[NudgeScheduler] Prisma disconnected cleanly.');
      } catch (dcErr: any) {
        logger.error(`[NudgeScheduler] Error disconnecting Prisma Client: ${dcErr?.message || dcErr}`);
        exitCode = 1;
      }
    }
    return exitCode;
  }

  static stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.initialTimeout) {
      clearTimeout(this.initialTimeout);
      this.initialTimeout = null;
    }
    this.isRunning = false;
    logger.info('[NudgeScheduler] Stopped conversion trial nudge scheduler');
  }
}
