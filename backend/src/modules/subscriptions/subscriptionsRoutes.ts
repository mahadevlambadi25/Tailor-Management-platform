import { Router } from 'express';
import { SubscriptionsController } from './subscriptionsController';
import { tenantContext } from '../../middleware/tenantContext';
import { authGuard } from '../../middleware/authGuard';
import { requireRoles } from '../../middleware/rbacGuard';
import { RoleType } from '@prisma/client';
import { config } from '../../config';

const router = Router();

// Publicly available subscription tier definitions
router.get('/plans', SubscriptionsController.getPlans);

// Authenticated tenant endpoints (Always accessible, even when subscription is EXPIRED)
router.use(tenantContext, authGuard);

router.get('/current', SubscriptionsController.getCurrentSubscription);

// Development/testing simulation route (strictly disabled in production)
if (config.nodeEnv !== 'production') {
  router.post('/dev-simulate', requireRoles(RoleType.SHOP_OWNER), SubscriptionsController.devSimulate);
}

export default router;
