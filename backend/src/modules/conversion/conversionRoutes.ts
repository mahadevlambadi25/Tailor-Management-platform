import { Router } from 'express';
import { ConversionController } from './conversionController';
import { tenantContext } from '../../middleware/tenantContext';
import { authGuard } from '../../middleware/authGuard';
import { requireRoles } from '../../middleware/rbacGuard';
import { RoleType } from '@prisma/client';
import { config } from '../../config';

const router = Router();

// Public / Flexible funnel event tracking (does not require strict auth)
router.post('/funnel/track', (req, res, next) => {
  // If authorization header is present, attempt tenant resolution
  if (req.headers.authorization) {
    tenantContext(req, res, () => {
      authGuard(req, res, () => {
        ConversionController.trackEvent(req, res);
      });
    });
  } else {
    ConversionController.trackEvent(req, res);
  }
});

// Public configuration (pricing)
router.get('/config', ConversionController.getPublicConfig);

// All following conversion routes require authenticated tenant context
router.use(tenantContext, authGuard);

// Backend feature flag enforcement
router.use((req, res, next) => {
  if (!config.conversionV1) {
    return res.status(404).json({
      success: false,
      error: {
        message: 'Conversion V1 features are currently disabled.',
        code: 'FEATURE_DISABLED'
      }
    });
  }
  next();
});

// Upgrade Progress & Pricing
router.get('/upgrade/progress', ConversionController.getUpgradeProgress);

// Onboarding
router.get('/onboarding/status', ConversionController.getOnboardingStatus);
router.post('/onboarding', ConversionController.submitOnboarding);

// First-Win Checklist
router.get('/checklist', ConversionController.getChecklist);
router.post('/checklist/dismiss', ConversionController.dismissChecklist);

// Guided Tour
router.post('/tour/complete', ConversionController.completeTour);

// Team Invites
router.post('/team/invite', ConversionController.inviteTeamMember);

// Customer Import
router.post('/import/preview', ConversionController.previewImport);
router.post('/import/commit', ConversionController.commitImport);

// Real SaaS Checkout Order Creation (Delegates strictly to Razorpay payment order)
router.post('/checkout', ConversionController.createCheckout);

// Super-Admin Funnel Telemetry (SAAS_OWNER / SAAS_SUPPORT only)
router.get('/admin/funnel', requireRoles(RoleType.SAAS_OWNER, RoleType.SAAS_SUPPORT), ConversionController.getAdminFunnel);

export default router;
