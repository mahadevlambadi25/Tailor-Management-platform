import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/prisma';
import { track } from './funnelService';
import { ChecklistService } from './checklistService';
import { PaymentGatewayService, CONVERSION_PRICING_PLANS } from './paymentGatewayService';
import { CustomerImportService } from './customerImportService';
import { config } from '../../config';
import { RoleType } from '@prisma/client';
import bcrypt from 'bcryptjs';

export class ConversionController {
  /**
   * Tracks a conversion funnel event.
   * Publicly accessible for landing page CTA, authenticated for in-app events.
   */
  static async trackEvent(req: Request, res: Response) {
    try {
      const { event, props } = req.body;
      const shopId = req.tenantId || 'anonymous';
      const userId = req.user?.id || null;

      if (!event) {
        return res.status(400).json({ success: false, error: { message: 'Event name is required' } });
      }

      await track(shopId, event, props, userId);
      return res.json({ success: true });
    } catch {
      // Funnel tracking must NEVER fail caller
      return res.json({ success: true });
    }
  }

  /**
   * Returns public conversion configuration (pricing, WhatsApp number).
   */
  static getPublicConfig(req: Request, res: Response) {
    return res.json({
      success: true,
      data: {
        conversionV1: config.conversionV1,
        whatsappNumber: config.whatsappNumber,
        pricing: CONVERSION_PRICING_PLANS
      }
    });
  }

  /**
   * Retrieves tenant progress for the Upgrade page.
   * Progress: real customerCount, orderCount, staffCount.
   */
  static async getUpgradeProgress(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          users: { where: { role: 'SHOP_OWNER' } },
          subscription: true
        }
      });

      if (!tenant) {
        return res.status(404).json({ success: false, error: { message: 'Tenant not found' } });
      }

      const [customerCount, orderCount, staffCount] = await Promise.all([
        prisma.customer.count({
          where: { tenantId, isDeleted: false }
        }),
        prisma.order.count({
          where: { tenantId, isCancelled: false }
        }),
        prisma.user.count({
          where: {
            tenantId,
            role: { in: ['TAILOR', 'CUTTER', 'FINISHER', 'MANAGER', 'RECEPTIONIST'] }
          }
        })
      ]);

      const firstName = tenant.users[0]?.name?.split(' ')[0] || 'Owner';

      // Recommendation rule:
      // Just me -> Starter
      // More than three shops -> Business
      // Otherwise Professional
      let recommendedPlan = 'PROFESSIONAL';
      if (tenant.teamSize === 'Just me') {
        recommendedPlan = 'STARTER';
      } else if (tenant.shopCount === 'More than three') {
        recommendedPlan = 'BUSINESS';
      }

      const activeSubscription = tenant.subscription || null;

      return res.json({
        success: true,
        data: {
          firstName,
          customerCount,
          orderCount,
          staffCount,
          recommendedPlan,
          teamSize: tenant.teamSize || '2 to 5',
          shopType: tenant.shopType || 'Atelier',
          activeSubscription
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Gets current onboarding status for tenant.
   */
  static async getOnboardingStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          onboardingCompleted: true,
          tourCompleted: true,
          shopType: true,
          teamSize: true,
          shopCount: true
        }
      });

      return res.json({
        success: true,
        data: tenant
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Saves onboarding questions responses.
   */
  static async submitOnboarding(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const userId = req.user?.id;
      const { shopType, teamSize, shopCount, skipped } = req.body;

      if (skipped) {
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { onboardingCompleted: true }
        });
        await track(tenantId, 'onboarding_skipped', {}, userId);
        return res.json({ success: true, message: 'Onboarding skipped' });
      }

      const resolvedShopType = shopType || 'Boutique';
      const resolvedTeamSize = teamSize || '2 to 5';
      const resolvedShopCount = shopCount || 'One';

      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          shopType: resolvedShopType,
          teamSize: resolvedTeamSize,
          shopCount: resolvedShopCount,
          onboardingCompleted: true
        }
      });

      await track(tenantId, 'onboarding_answered', {
        shopType: resolvedShopType,
        teamSize: resolvedTeamSize,
        shopCount: resolvedShopCount
      }, userId);

      return res.json({
        success: true,
        message: 'Shop preferences saved successfully.',
        data: {
          shopType: resolvedShopType,
          teamSize: resolvedTeamSize,
          shopCount: resolvedShopCount,
          completed: true
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Gets First-Win checklist status.
   */
  static async getChecklist(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const status = await ChecklistService.getChecklistStatus(tenantId);
      return res.json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Dismisses First-Win checklist card.
   */
  static async dismissChecklist(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      await ChecklistService.dismissChecklist(tenantId);
      return res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Marks guided tour as completed.
   */
  static async completeTour(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const userId = req.user?.id;

      await prisma.tenant.update({
        where: { id: tenantId },
        data: { tourCompleted: true }
      });

      await track(tenantId, 'tour_completed', {}, userId);
      return res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Invites team member to shop workspace.
   */
  static async inviteTeamMember(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const userId = req.user?.id;
      const { name, phone, role, email } = req.body;

      if (!name || !phone) {
        return res.status(400).json({ success: false, error: { message: 'Name and phone number are required' } });
      }

      const cleanPhone = String(phone).replace(/[^0-9]/g, '');
      const staffRole = (role as RoleType) || RoleType.CUTTER;
      const normalizedEmail = email ? email.toLowerCase().trim() : `staff.${cleanPhone}@tailorpro.local`;

      // Check if user with this email already exists under this tenant
      let existingUser = await prisma.user.findFirst({
        where: { tenantId, email: normalizedEmail }
      });

      let createdUser;
      if (existingUser) {
        createdUser = existingUser;
      } else {
        const dummyPassword = await bcrypt.hash(`Invite@${cleanPhone.slice(-4)}`, 10);
        createdUser = await prisma.user.create({
          data: {
            tenantId,
            name,
            email: normalizedEmail,
            phone: cleanPhone,
            role: staffRole,
            passwordHash: dummyPassword,
            isActive: true
          }
        });
      }

      // Track staff_invited
      await track(tenantId, 'staff_invited', {
        role: staffRole,
        staffId: createdUser.id
      }, userId);

      return res.status(201).json({
        success: true,
        message: `Staff account created for ${name}. Messaging integration is not configured.`,
        data: {
          user: {
            id: createdUser.id,
            name: createdUser.name,
            role: createdUser.role,
            phone: cleanPhone
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Previews customer import file.
   */
  static async previewImport(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { rows, columnMapping } = req.body;
      const result = await CustomerImportService.preview(tenantId, rows, columnMapping);
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: { message: err?.message } });
    }
  }

  /**
   * Commits customer import batch.
   */
  static async commitImport(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const userId = req.user?.id;
      const { validRows } = req.body;
      const result = await CustomerImportService.commit(tenantId, validRows, userId);
      return res.json({
        success: true,
        message: `Successfully imported ${result.importedCount} customers.`,
        data: result
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: { message: err?.message } });
    }
  }

  /**
   * Creates a real Razorpay checkout session.
   */
  static async createCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const userId = req.user?.id;
      const { plan = 'PROFESSIONAL', cycle = 'ANNUAL' } = req.body;

      const checkout = await PaymentGatewayService.createCheckout(plan, cycle, tenantId, userId);
      return res.json({ success: true, data: checkout });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin Funnel Analytics (Super-admin only: SAAS_OWNER or SAAS_SUPPORT).
   */
  static async getAdminFunnel(req: Request, res: Response, next: NextFunction) {
    try {
      const { weekFilter } = req.query as { weekFilter?: string };

      // Optional date filter by signup week
      let dateFilter: any = undefined;
      if (weekFilter) {
        const weekDate = new Date(weekFilter);
        const nextWeek = new Date(weekDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        dateFilter = { gte: weekDate, lt: nextWeek };
      }

      // Funnel event keys in logical progression order
      const funnelSteps = [
        { key: 'landing_cta_clicked', label: '1. Landing CTA Clicked' },
        { key: 'signup_completed', label: '2. Signup Completed' },
        { key: 'onboarding_answered', label: '3. Onboarding Answered' },
        { key: 'first_customer', label: '4. First Real Customer' },
        { key: 'first_measurement', label: '5. First Measurement Saved' },
        { key: 'first_order', label: '6. First Order Created' },
        { key: 'staff_invited', label: '7. Staff Invited' },
        { key: 'import_completed', label: '8. Customer Import Completed' },
        { key: 'tour_completed', label: '9. Guided Tour Completed' },
        { key: 'upgrade_viewed', label: '10. Upgrade Page Viewed' },
        { key: 'checkout_started', label: '11. Checkout Started' },
        { key: 'payment_succeeded', label: '12. Payment Succeeded' }
      ];

      // Fetch aggregated event counts
      const counts: Record<string, number> = {};
      for (const step of funnelSteps) {
        const count = await prisma.funnelEvent.count({
          where: {
            event: step.key,
            ...(dateFilter ? { createdAt: dateFilter } : {})
          }
        });
        counts[step.key] = count;
      }

      // Calculate conversion drop-offs relative to top of funnel
      const topCount = counts['landing_cta_clicked'] || counts['signup_completed'] || 1;

      const stepsData = funnelSteps.map((step, idx) => {
        const count = counts[step.key] || 0;
        const prevCount = idx === 0 ? topCount : (counts[funnelSteps[idx - 1].key] || 0);
        const overallConversion = topCount > 0 ? ((count / topCount) * 100).toFixed(1) : '0.0';
        const stepConversion = prevCount > 0 ? ((count / prevCount) * 100).toFixed(1) : '0.0';

        return {
          key: step.key,
          label: step.label,
          count,
          overallConversionPercentage: parseFloat(overallConversion),
          stepConversionPercentage: parseFloat(stepConversion)
        };
      });

      // Total unique shops tracked
      const totalShopsTracked = await prisma.tenant.count();

      return res.json({
        success: true,
        data: {
          totalShopsTracked,
          steps: stepsData,
          filterApplied: weekFilter || 'all_time'
        }
      });
    } catch (err) {
      next(err);
    }
  }
}
