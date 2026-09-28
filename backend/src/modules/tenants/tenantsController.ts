import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/prisma';
import '../../middleware/tenantContext';
import {
  purgeTenantDemoData,
  getDemoStats,
  seedDemoDataForTenant
} from '../demo/demoService';
import { subscriptionService } from '../subscriptions/subscriptionService';

export { purgeTenantDemoData };

export class TenantsController {
  static async getTenant(req: Request, res: Response, next: NextFunction) {
    try {
      // Ensure subscription status is up to date (auto-expiring trial if expired)
      const currentSub = await subscriptionService.checkSubscriptionStatus(req.tenantId!);

      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        include: {
          subscription: true,
          featureFlags: true,
          branches: { where: { isActive: true } }
        }
      });

      if (tenant && currentSub) {
        tenant.subscription = currentSub;
      }

      // Count active demo records using indexed isDemo flag and isolated relationships
      const demoStats = await getDemoStats(req.tenantId!);

      return res.json({
        success: true,
        data: {
          ...tenant,
          demoStats
        }
      });
    } catch (err) { next(err); }
  }

  static async updateTenant(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, phone, email, address, city, state, pincode, gstNumber, gstin, defaultUnit, currency } = req.body;
      const dataToUpdate: any = {};
      if (name !== undefined) dataToUpdate.name = name;
      if (phone !== undefined) dataToUpdate.phone = phone;
      if (email !== undefined) dataToUpdate.email = email;
      if (address !== undefined) dataToUpdate.address = address;
      if (city !== undefined) dataToUpdate.city = city;
      if (state !== undefined) dataToUpdate.state = state;
      if (pincode !== undefined) dataToUpdate.pincode = pincode;
      if (gstNumber !== undefined || gstin !== undefined) dataToUpdate.gstNumber = gstNumber || gstin;
      if (defaultUnit !== undefined) dataToUpdate.defaultUnit = defaultUnit;
      if (currency !== undefined) dataToUpdate.currency = currency;

      const updated = await prisma.tenant.update({
        where: { id: req.tenantId },
        data: dataToUpdate
      });
      return res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  }

  static async toggleFeatureFlag(req: Request, res: Response, next: NextFunction) {
    try {
      const { featureKey, isEnabled } = req.body;
      const flag = await prisma.featureFlag.upsert({
        where: { tenantId_featureKey: { tenantId: req.tenantId!, featureKey } },
        update: { isEnabled },
        create: { tenantId: req.tenantId!, featureKey, isEnabled }
      });
      return res.json({ success: true, data: flag });
    } catch (err) { next(err); }
  }

  // Load realistic Demo Data with isDemo: true flag
  static async loadDemoData(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;

      const existingStats = await getDemoStats(tenantId);
      if (existingStats.hasDemoData) {
        return res.json({
          success: true,
          message: 'Demo data is already active in your atelier.',
          data: existingStats
        });
      }

      const stats = await seedDemoDataForTenant(tenantId);

      // Audit Log
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: req.user?.id,
          action: 'DEMO_DATA_LOADED',
          entity: 'Tenant',
          entityId: tenantId,
          details: { ...stats, isDemo: true }
        }
      });

      return res.json({
        success: true,
        message: 'Demo data loaded successfully! Sample clients, bespoke orders, inventory, staff roles, and appointments are now active in your atelier.',
        data: stats
      });
    } catch (err) { next(err); }
  }

  // Clear / Purge all Demo Data directly (manual action or maintenance)
  static async clearDemoData(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;

      const purgeResult = await purgeTenantDemoData(tenantId);

      // Audit Log
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: req.user?.id,
          action: 'DEMO_DATA_PURGED',
          entity: 'Tenant',
          entityId: tenantId,
          details: { ...purgeResult } as any
        }
      });

      return res.json({
        success: true,
        message: `All demo data removed successfully! (${purgeResult.deletedOrdersCount} orders, ${purgeResult.deletedCustomersCount} customers, ${purgeResult.deletedAppointmentsCount} appointments, ${purgeResult.deletedInventoryCount} inventory items deleted). Atelier is clean.`,
        data: purgeResult
      });
    } catch (err) { next(err); }
  }

  // 1. Subscription Checkout: Initiates subscription checkout. Status is PENDING. Demo data is NOT deleted!
  static async checkoutSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { planName = 'PRO_ENTERPRISE' } = req.body;

      const subscription = await prisma.subscription.upsert({
        where: { tenantId },
        update: {
          planName,
          status: 'PENDING'
        },
        create: {
          tenantId,
          planName,
          status: 'PENDING'
        }
      });

      return res.json({
        success: true,
        message: 'Subscription checkout initiated. Payment is pending confirmation. All your workspace data is safely preserved.',
        data: {
          subscription,
          checkoutSessionId: `sess_${Date.now()}_${tenantId.substring(0, 6)}`,
          status: 'PENDING',
          demoDataRetained: true
        }
      });
    } catch (err) { next(err); }
  }

  // 2. Subscription Cancel: Customer abandons checkout. Status CANCELLED.
  static async cancelSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;

      const subscription = await prisma.subscription.update({
        where: { tenantId },
        data: { status: 'CANCELLED' }
      });

      return res.json({
        success: true,
        message: 'Subscription checkout was cancelled. No payment charged. All your workspace data remains intact.',
        data: {
          subscription,
          status: 'CANCELLED',
          demoDataRetained: true
        }
      });
    } catch (err) { next(err); }
  }

  // 3. Subscription Fail: Payment gateway reports card decline or error. Status PAST_DUE.
  static async failSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { reason = 'Payment declined by card issuer' } = req.body;

      const subscription = await prisma.subscription.update({
        where: { tenantId },
        data: { status: 'PAST_DUE' }
      });

      return res.json({
        success: true,
        message: `Subscription payment failed: ${reason}. All your workspace data remains intact.`,
        data: {
          subscription,
          status: 'PAST_DUE',
          failureReason: reason,
          demoDataRetained: true
        }
      });
    } catch (err) { next(err); }
  }

  // 4. Subscription Confirm: Payment is successfully verified! Status ACTIVE. ONLY NOW is demo data purged!
  static async confirmSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { planName = 'PRO_ENTERPRISE_ACTIVE', paymentId = `PAY_SUCC_${Date.now()}` } = req.body;

      // Update Subscription status to ACTIVE
      const periodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const subscription = await prisma.subscription.upsert({
        where: { tenantId },
        update: {
          planName,
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: periodEnd,
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd
        },
        create: {
          tenantId,
          planName,
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: periodEnd,
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd
        }
      });

      // For demo tenants only: execute atomic deletion of demo data upon payment confirmation
      const tenantRecord = await prisma.tenant.findUnique({ where: { id: tenantId } });
      let purgeResult = { deletedOrdersCount: 0, deletedCustomersCount: 0, deletedAppointmentsCount: 0, deletedInventoryCount: 0 };
      if (tenantRecord?.isDemo) {
        purgeResult = await purgeTenantDemoData(tenantId);
      }

      // Audit Log
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: req.user?.id,
          action: 'SUBSCRIPTION_CONFIRMED_ACTIVE',
          entity: 'Subscription',
          entityId: subscription.id,
          details: { planName, paymentId, ...purgeResult }
        }
      });

      const message = tenantRecord?.isDemo && (purgeResult.deletedOrdersCount > 0 || purgeResult.deletedCustomersCount > 0)
        ? `Subscription payment confirmed and activated! Demo records cleared. Your atelier is ready for production.`
        : `Subscription payment confirmed and activated! Your workspace is ready for production.`;

      return res.json({
        success: true,
        message,
        data: {
          subscription,
          paymentId,
          purgeResult
        }
      });
    } catch (err) { next(err); }
  }

  // Legacy route alias to confirmSubscription
  static async subscribe(req: Request, res: Response, next: NextFunction) {
    return TenantsController.confirmSubscription(req, res, next);
  }
}
