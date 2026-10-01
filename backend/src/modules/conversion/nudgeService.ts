import { prisma } from '../../core/prisma';
import { logger } from '../../core/logger';
import { MessageSender } from './messagingService';
import { config } from '../../config';

export class NudgeService {
  /**
   * Evaluates and dispatches appropriate nudges for a tenant.
   * STRICT RULES:
   * 1. Max one nudge per calendar day per shop.
   * 2. Immediately stop all nudges if subscription is ACTIVE.
   * 3. Each nudge key can ONLY be sent once per shop.
   * 4. Never send real external messages through the stub.
   */
  static async evaluateShopNudges(shopId: string): Promise<string | null> {
    if (!config.conversionV1) return null;

    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: shopId },
        include: {
          subscription: true,
          users: { where: { role: 'SHOP_OWNER' } }
        }
      });

      if (!tenant) return null;

      // Rule: Stop all nudges immediately after successful payment
      if (tenant.subscription?.status === 'ACTIVE') {
        return null;
      }

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Rule: Maximum one nudge per day per shop
      const recentNudge = await prisma.nudgeLog.findFirst({
        where: {
          shopId,
          sentAt: { gte: oneDayAgo }
        }
      });
      if (recentNudge) {
        return null;
      }

      // Fetch tenant stats (real data only)
      const [realCustomerCount, realOrderCount, readyCount, staffCount] = await Promise.all([
        prisma.customer.count({ where: { tenantId: shopId, isSample: { not: true }, isDemo: false } }),
        prisma.order.count({ where: { tenantId: shopId, isSample: { not: true }, isDemo: false } }),
        prisma.order.count({ where: { tenantId: shopId, isSample: { not: true }, isDemo: false, status: 'READY_FOR_PICKUP' } }),
        prisma.user.count({ where: { tenantId: shopId, isSample: { not: true }, role: { not: 'SHOP_OWNER' } } })
      ]);

      const owner = tenant.users[0];
      const firstName = owner?.name?.split(' ')[0] || 'there';
      const phone = tenant.phone || owner?.phone || '9999999999';
      const baseUrl = config.frontendUrl || 'http://localhost:5173';
      const shopLink = `${baseUrl}/dashboard`;
      const upgradeLink = `${baseUrl}/upgrade`;

      const hoursSinceSignup = (now.getTime() - new Date(tenant.createdAt).getTime()) / (1000 * 60 * 60);
      const daysSinceSignup = hoursSinceSignup / 24;

      let trialDaysRemaining = 14;
      if (tenant.subscription?.trialEnd) {
        trialDaysRemaining = Math.max(0, Math.ceil((new Date(tenant.subscription.trialEnd).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      }

      // Candidate nudges in priority sequence:
      const candidateNudges: Array<{ key: string; templateKey: string; vars: Record<string, any>; condition: boolean }> = [
        // Day 13: Tomorrow trial ends
        {
          key: 'nudge_day13',
          templateKey: 'nudge_day13',
          vars: { firstName, customerCount: realCustomerCount, orderCount: realOrderCount, upgradeLink },
          condition: (trialDaysRemaining <= 1 || daysSinceSignup >= 13)
        },
        // Day 11: 3 days left
        {
          key: 'nudge_day11',
          templateKey: 'nudge_day11',
          vars: { firstName, upgradeLink },
          condition: (trialDaysRemaining <= 3 || daysSinceSignup >= 11)
        },
        // Day 7 active
        {
          key: 'nudge_day7_active',
          templateKey: 'nudge_day7_active',
          vars: { orderCount: realOrderCount, readyCount, upgradeLink },
          condition: (daysSinceSignup >= 7 && realOrderCount > 0)
        },
        // Day 7 inactive
        {
          key: 'nudge_day7_inactive',
          templateKey: 'nudge_day7_inactive',
          vars: { link: shopLink },
          condition: (daysSinceSignup >= 7 && realOrderCount === 0)
        },
        // Real order created and no staff invited
        {
          key: 'nudge_first_order_no_staff',
          templateKey: 'nudge_first_order_no_staff',
          vars: { link: `${baseUrl}/staff` },
          condition: (realOrderCount > 0 && staffCount === 0)
        },
        // 24 hours with no real customer
        {
          key: 'nudge_24h_no_customer',
          templateKey: 'nudge_24h_no_customer',
          vars: { firstName, link: `${baseUrl}/customers` },
          condition: (hoursSinceSignup >= 24 && realCustomerCount === 0)
        },
        // 1 hour after signup
        {
          key: 'nudge_1h',
          templateKey: 'nudge_1h',
          vars: { firstName, link: shopLink },
          condition: (hoursSinceSignup >= 1)
        }
      ];

      for (const nudge of candidateNudges) {
        if (!nudge.condition) continue;

        // Check if already sent
        const alreadySent = await prisma.nudgeLog.findUnique({
          where: {
            shopId_key: {
              shopId,
              key: nudge.key
            }
          }
        });

        if (alreadySent) continue;

        // Dispatch through MessageSender stub
        await MessageSender.send({
          to: phone,
          templateKey: nudge.templateKey,
          vars: nudge.vars,
          tenantId: shopId
        });

        // Record in NudgeLog
        await prisma.nudgeLog.create({
          data: {
            shopId,
            key: nudge.key,
            channel: 'WHATSAPP',
            status: 'SENT'
          }
        });

        logger.info(`[NudgeService] Dispatched nudge '${nudge.key}' to shop ${shopId}`);
        return nudge.key;
      }

      return null;
    } catch (err: any) {
      logger.error(`[NudgeService] Error evaluating nudges for shop ${shopId}: ${err?.message}`, err);
      return null;
    }
  }

  /**
   * Dispatches payment recovery reminder.
   * Triggered at 1 hour, 24 hours, 3 days following checkout abandonment or payment failure.
   */
  static async sendPaymentRecovery(tenantId: string, interval: '1h' | '24h' | '3d'): Promise<boolean> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          subscription: true,
          users: { where: { role: 'SHOP_OWNER' } }
        }
      });

      if (!tenant) return false;

      // Stop immediately after successful payment
      if (tenant.subscription?.status === 'ACTIVE') {
        return false;
      }

      const key = `payment_recovery_${interval}`;

      // Idempotency check
      const alreadySent = await prisma.nudgeLog.findUnique({
        where: {
          shopId_key: {
            shopId: tenantId,
            key
          }
        }
      });
      if (alreadySent) return false;

      const owner = tenant.users[0];
      const firstName = owner?.name?.split(' ')[0] || 'there';
      const phone = tenant.phone || owner?.phone || '9999999999';
      const baseUrl = config.frontendUrl || 'http://localhost:5173';
      const payLink = `${baseUrl}/upgrade?recovery=true`;

      await MessageSender.send({
        to: phone,
        templateKey: key,
        vars: { firstName, payLink },
        tenantId
      });

      await prisma.nudgeLog.create({
        data: {
          shopId: tenantId,
          key,
          channel: 'WHATSAPP',
          status: 'SENT'
        }
      });

      logger.info(`[NudgeService] Dispatched payment recovery '${key}' for tenant ${tenantId}`);
      return true;
    } catch (err: any) {
      logger.error(`[NudgeService] Failed to send payment recovery for ${tenantId}: ${err?.message}`, err);
      return false;
    }
  }
}
