import { Router } from 'express';
import { AlterationsController } from './alterationsController';
import { tenantContext } from '../../middleware/tenantContext';
import { authGuard } from '../../middleware/authGuard';
import { subscriptionGuard } from '../../middleware/subscriptionGuard';
import { requireRoles } from '../../middleware/rbacGuard';
import { RoleType } from '@prisma/client';

const router = Router();
router.use(tenantContext, authGuard, subscriptionGuard);

router.get('/', AlterationsController.list);
router.put('/:id', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.TAILOR), AlterationsController.updateStatus);

export default router;
