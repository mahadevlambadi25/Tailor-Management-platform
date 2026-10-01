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

export default router;
