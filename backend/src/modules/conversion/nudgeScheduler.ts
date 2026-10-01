import { prisma } from '../../core/prisma';
import { logger } from '../../core/logger';
import { config } from '../../config';
import { NudgeService } from './nudgeService';

export class NudgeScheduler {
  private static timer: NodeJS.Timeout | null = null;

  static start() {
    if (!config.conversionV1) {
      logger.info('[NudgeScheduler] CONVERSION_V1 is disabled; scheduled runner inactive');
      return;
    }

    if (this.timer) {
      this.stop();
    }

    logger.info('[NudgeScheduler] Starting conversion trial nudge scheduler');

    // Run scheduled cycle every 30 minutes
    const intervalMs = 30 * 60 * 1000;
    this.timer = setInterval(async () => {
      await this.runCycle();
    }, intervalMs);

    // Run an initial safe cycle 10 seconds after server bootstrap
    setTimeout(async () => {
      await this.runCycle();
    }, 10000);
  }

  static async runCycle() {
    try {
      if (!config.conversionV1) return;

      const candidateTenants = await prisma.tenant.findMany({
        where: {
          subscription: {
            status: { in: ['TRIAL', 'PENDING'] }
          }
        },
        select: { id: true }
      });

      for (const tenant of candidateTenants) {
        await NudgeService.evaluateShopNudges(tenant.id);
      }
    } catch (err: any) {
      logger.error(`[NudgeScheduler] Error executing scheduled nudge cycle: ${err?.message}`, err);
    }
  }

  static stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('[NudgeScheduler] Stopped conversion trial nudge scheduler');
    }
  }
}
