import { prisma } from '../../core/prisma';
import { logger } from '../../core/logger';
import { config } from '../../config';
import { NudgeService } from './nudgeService';

export interface RunCycleOptions {
  force?: boolean;
}

export interface RunCycleResult {
  processedCount: number;
  candidateCount: number;
  skipped: boolean;
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
      return { processedCount, candidateCount: candidateTenants.length, skipped: false };
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
      logger.info(`[NudgeScheduler] Standalone cycle completed: processed ${result.processedCount}/${result.candidateCount} tenants (skipped: ${result.skipped})`);
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
