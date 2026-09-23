import { Router } from 'express';
import { GarmentsController } from './garmentsController';
import { tenantContext } from '../../middleware/tenantContext';
import { authGuard } from '../../middleware/authGuard';
import { subscriptionGuard } from '../../middleware/subscriptionGuard';
import { requireRoles } from '../../middleware/rbacGuard';
import { RoleType } from '@prisma/client';

const router = Router();
router.use(tenantContext, authGuard, subscriptionGuard);

router.get('/', GarmentsController.list);
router.post('/', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER), GarmentsController.create);

export default router;
