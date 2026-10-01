import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/prisma';
import '../../middleware/tenantContext';
import { subscriptionService } from '../subscriptions/subscriptionService';

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

      return res.json({
        success: true,
        data: tenant
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
}
