import { Router } from 'express';
import { TenantsController } from './tenantsController';
import { tenantContext } from '../../middleware/tenantContext';
import { authGuard } from '../../middleware/authGuard';
import { requireRoles } from '../../middleware/rbacGuard';
import { RoleType } from '@prisma/client';

const router = Router();
router.use(tenantContext, authGuard);

router.get('/', TenantsController.getTenant);
router.put('/', requireRoles(RoleType.SHOP_OWNER), TenantsController.updateTenant);
router.put('/:id', requireRoles(RoleType.SHOP_OWNER), TenantsController.updateTenant);
router.post('/feature-flags', requireRoles(RoleType.SHOP_OWNER), TenantsController.toggleFeatureFlag);
router.post('/demo-data/load', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER), TenantsController.loadDemoData);
router.post('/demo-data/clear', requireRoles(RoleType.SHOP_OWNER), TenantsController.clearDemoData);

// Payment-safe subscription lifecycle endpoints
router.post('/subscription/checkout', requireRoles(RoleType.SHOP_OWNER), TenantsController.checkoutSubscription);
router.post('/subscription/cancel', requireRoles(RoleType.SHOP_OWNER), TenantsController.cancelSubscription);
router.post('/subscription/fail', requireRoles(RoleType.SHOP_OWNER), TenantsController.failSubscription);
router.post('/subscription/confirm', requireRoles(RoleType.SHOP_OWNER), TenantsController.confirmSubscription);

// Legacy subscription route (auto-confirms and cleans demo data)
router.post('/subscribe', requireRoles(RoleType.SHOP_OWNER), TenantsController.subscribe);

export default router;
