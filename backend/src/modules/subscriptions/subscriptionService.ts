import { prisma } from '../../core/prisma';
import { logger } from '../../core/logger';
import { config } from '../../config';
import { SubscriptionStatus } from '@prisma/client';
import { purgeTenantDemoData } from '../demo/demoService';

export { SubscriptionStatus };

export const SUBSCRIPTION_PLANS: Record<string, {
  name: string;
  displayName: string;
  maxOrdersPerMonth: number;
  maxStaff: number;
  maxBranches: number;
  features: string[];
}> = {
  FREE_TRIAL: {
    name: 'FREE_TRIAL',
    displayName: '14-Day Free Trial',
    maxOrdersPerMonth: 100,
    maxStaff: 5,
    maxBranches: 1,
    features: ['Core Orders', 'Appointments', 'Measurements', 'Catalog']
  },
  STARTER: {
    name: 'STARTER',
    displayName: 'Starter Atelier',
    maxOrdersPerMonth: 500,
    maxStaff: 15,
    maxBranches: 2,
    features: ['Core Orders', 'Kanban Production', 'Measurements', 'Customer Portal']
  },
  PROFESSIONAL: {
    name: 'PROFESSIONAL',
    displayName: 'Professional Boutique',
    maxOrdersPerMonth: 2000,
    maxStaff: 50,
    maxBranches: 5,
    features: ['All Starter Features', 'Advanced Reports', 'Multi-Branch', 'Audit Logs']
  },
  BUSINESS: {
    name: 'BUSINESS',
    displayName: 'Enterprise Haute Couture',
    maxOrdersPerMonth: 10000,
    maxStaff: 200,
    maxBranches: 20,
    features: ['Unlimited Everything', 'Priority SLA', 'Dedicated Telemetry']
  }
};

export class SubscriptionService {
  /**
   * Retrieves the tenant's subscription. If missing, auto-provisions a TRIAL subscription.
   * Also performs lazy idempotent expiration resolution.
   */
  static async getTenantSubscription(tenantId: string) {
    let sub = await prisma.subscription.findUnique({
      where: { tenantId }
    });

    if (!sub) {
      logger.info(`[SubscriptionService] Provisioning new TRIAL subscription for tenant: ${tenantId}`);
      sub = await this.createTrialSubscription(tenantId);
    }

    // Evaluate trial expiration idempotently
    return this.resolveExpiration(sub);
  }

  /**
   * Provisions a brand new TRIAL subscription for a tenant with configurable duration.
   */
  static async createTrialSubscription(tenantId: string, durationDays = config.trialDurationDays) {
    const now = new Date();
    const trialEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const planConfig = SUBSCRIPTION_PLANS.FREE_TRIAL;

    return prisma.subscription.create({
      data: {
        tenantId,
        planName: planConfig.name,
        status: SubscriptionStatus.TRIAL,
        trialStart: now,
        trialEnd,
        startDate: now,
        endDate: trialEnd,
        maxOrdersPerMonth: planConfig.maxOrdersPerMonth,
        maxStaff: planConfig.maxStaff,
        maxBranches: planConfig.maxBranches
      }
    });
  }

  /**
   * Idempotently checks if a TRIAL has passed its trialEnd.
   * If expired, transitions status to EXPIRED.
   * CRITICAL GUARANTEE: Never deletes demo data or real records!
   */
  static async resolveExpiration(subscription: any) {
    if (subscription.status === SubscriptionStatus.TRIAL && subscription.trialEnd) {
      const now = new Date();
      if (now > new Date(subscription.trialEnd)) {
        logger.warn(`[SubscriptionService] Tenant ${subscription.tenantId} trial has expired on ${subscription.trialEnd.toISOString()}. Marking EXPIRED.`);
        
        const updated = await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: SubscriptionStatus.EXPIRED }
        });

        // Audit Log
        await prisma.auditLog.create({
          data: {
            tenantId: subscription.tenantId,
            action: 'TRIAL_EXPIRED',
            entity: 'Subscription',
            entityId: subscription.id,
            details: {
              previousStatus: SubscriptionStatus.TRIAL,
              newStatus: SubscriptionStatus.EXPIRED,
              expiredAt: now.toISOString(),
              demoDataPreserved: true
            }
          }
        }).catch((err) => logger.error('[SubscriptionService] Failed to create audit log for trial expiration', err));

        return updated;
      }
    }
    return subscription;
  }

  /**
   * Checks current subscription status for a tenant (evaluates expiration).
   */
  static async checkSubscriptionStatus(tenantId: string) {
    return this.getTenantSubscription(tenantId);
  }

  /**
   * Evaluates whether a subscription is currently active and permitted for business operations.
   */
  static isSubscriptionActive(sub: any): boolean {
    if (!sub) return false;
    if (sub.status === SubscriptionStatus.ACTIVE) return true;
    if (sub.status === SubscriptionStatus.TRIAL) {
      if (!sub.trialEnd) return true;
      return new Date() <= new Date(sub.trialEnd);
    }
    return false;
  }

  /**
   * Activates a subscription (future payment integration target).
   * ONLY during confirmed payment / activation may demo data optionally be cleaned.
   */
  static async activateSubscription(tenantId: string, planName = 'PROFESSIONAL', options?: { clearDemo?: boolean; paymentId?: string }) {
    const planConfig = SUBSCRIPTION_PLANS[planName] || SUBSCRIPTION_PLANS.PROFESSIONAL;
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const subscription = await prisma.subscription.upsert({
      where: { tenantId },
      update: {
        planName,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        startDate: now,
        endDate: periodEnd,
        maxOrdersPerMonth: planConfig.maxOrdersPerMonth,
        maxStaff: planConfig.maxStaff,
        maxBranches: planConfig.maxBranches
      },
      create: {
        tenantId,
        planName,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        startDate: now,
        endDate: periodEnd,
        maxOrdersPerMonth: planConfig.maxOrdersPerMonth,
        maxStaff: planConfig.maxStaff,
        maxBranches: planConfig.maxBranches
      }
    });

    let purgeResult = null;
    if (options?.clearDemo) {
      purgeResult = await purgeTenantDemoData(tenantId);
    }

    return { subscription, purgeResult };
  }

  /**
   * Generates a sanitized summary suitable for client consumption.
   */
  static async getSubscriptionSummary(tenantId: string) {
    const sub = await this.getTenantSubscription(tenantId);
    const now = new Date();
    let daysRemaining = 0;

    if (sub.status === SubscriptionStatus.TRIAL && sub.trialEnd) {
      const diffMs = new Date(sub.trialEnd).getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    const isActive = this.isSubscriptionActive(sub);
    const isTrial = sub.status === SubscriptionStatus.TRIAL;
    const isExpired = sub.status === SubscriptionStatus.EXPIRED;

    return {
      id: sub.id,
      tenantId: sub.tenantId,
      planName: sub.planName,
      status: sub.status,
      trialStart: sub.trialStart,
      trialEnd: sub.trialEnd,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      daysRemaining,
      isActive,
      isTrial,
      isExpired,
      maxOrdersPerMonth: sub.maxOrdersPerMonth,
      maxStaff: sub.maxStaff,
      maxBranches: sub.maxBranches
    };
  }

  /**
   * Simulation helper for development and automated test fixtures.
   * STRICT GUARANTEE: Never callable in production.
   */
  static async devSimulateStatus(tenantId: string, status: SubscriptionStatus, planName?: string) {
    if (config.nodeEnv === 'production' || process.env.NODE_ENV === 'production') {
      throw new Error('Forbidden: devSimulateStatus is strictly disabled in production environments.');
    }

    const now = new Date();
    const dataToUpdate: any = { status };
    if (planName) dataToUpdate.planName = planName;

    if (status === SubscriptionStatus.EXPIRED) {
      // Simulate trialEnd expired yesterday
      dataToUpdate.trialStart = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
      dataToUpdate.trialEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (status === SubscriptionStatus.TRIAL) {
      dataToUpdate.trialStart = now;
      dataToUpdate.trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    } else if (status === SubscriptionStatus.ACTIVE) {
      dataToUpdate.currentPeriodStart = now;
      dataToUpdate.currentPeriodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    }

    return prisma.subscription.update({
      where: { tenantId },
      data: dataToUpdate
    });
  }
}

export const subscriptionService = SubscriptionService;
