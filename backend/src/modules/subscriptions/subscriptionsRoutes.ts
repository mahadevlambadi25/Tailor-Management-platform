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

// Razorpay Webhook endpoint (verified via HMAC signature; unauthenticated from client standpoint)
router.post('/webhook', SubscriptionsController.handleWebhook);

// Authenticated tenant endpoints (Always accessible, even when subscription is EXPIRED)
router.use(tenantContext, authGuard);

router.get('/current', SubscriptionsController.getCurrentSubscription);

// Razorpay checkout order creation
router.post('/checkout', requireRoles(RoleType.SHOP_OWNER), SubscriptionsController.checkout);

// Razorpay payment verification
router.post('/verify-payment', requireRoles(RoleType.SHOP_OWNER), SubscriptionsController.verifyPayment);
router.post('/verify', requireRoles(RoleType.SHOP_OWNER), SubscriptionsController.verifyPayment);

// Development/testing simulation route (strictly disabled in production)
if (config.nodeEnv !== 'production') {
  router.post('/dev-simulate', requireRoles(RoleType.SHOP_OWNER), SubscriptionsController.devSimulate);
}

export default router;
