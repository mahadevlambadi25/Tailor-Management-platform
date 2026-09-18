import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/prisma';
import '../../middleware/tenantContext';
import {
  purgeTenantDemoData,
  getDemoStats,
  seedDemoDataForTenant
} from '../demo/demoService';

export { purgeTenantDemoData };

export class TenantsController {
  static async getTenant(req: Request, res: Response, next: NextFunction) {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        include: {
          subscription: true,
          featureFlags: true,
          branches: { where: { isActive: true } }
        }
      });

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
        message: 'Subscription checkout initiated. Payment is pending confirmation. Demo data is retained until payment succeeds.',
        data: {
          subscription,
          checkoutSessionId: `sess_${Date.now()}_${tenantId.substring(0, 6)}`,
          status: 'PENDING',
          demoDataRetained: true
        }
      });
    } catch (err) { next(err); }
  }

  // 2. Subscription Cancel: Customer abandons checkout. Status CANCELLED. Demo data is NOT deleted!
  static async cancelSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;

      const subscription = await prisma.subscription.update({
        where: { tenantId },
        data: { status: 'CANCELLED' }
      });

      return res.json({
        success: true,
        message: 'Subscription checkout was cancelled. No payment charged. Demo data has been retained.',
        data: {
          subscription,
          status: 'CANCELLED',
          demoDataRetained: true
        }
      });
    } catch (err) { next(err); }
  }

  // 3. Subscription Fail: Payment gateway reports card decline or error. Status FAILED. Demo data is NOT deleted!
  static async failSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { reason = 'Payment declined by card issuer' } = req.body;

      const subscription = await prisma.subscription.update({
        where: { tenantId },
        data: { status: 'FAILED' }
      });

      return res.json({
        success: true,
        message: `Subscription payment failed: ${reason}. Demo data has been retained.`,
        data: {
          subscription,
          status: 'FAILED',
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
      const subscription = await prisma.subscription.upsert({
        where: { tenantId },
        update: {
          planName,
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        },
        create: {
          tenantId,
          planName,
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        }
      });

      // ONLY AFTER CONFIRMED SUCCESSFUL PAYMENT: Execute atomic deletion of demo data
      const purgeResult = await purgeTenantDemoData(tenantId);

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

      return res.json({
        success: true,
        message: `Subscription payment confirmed and activated! All demo data has been purged (${purgeResult.deletedOrdersCount} orders, ${purgeResult.deletedCustomersCount} clients, ${purgeResult.deletedAppointmentsCount} appointments, ${purgeResult.deletedInventoryCount} inventory items removed). Your atelier is now ready for real production orders.`,
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
