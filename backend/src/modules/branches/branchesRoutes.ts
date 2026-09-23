import { Router } from 'express';
import { BranchesController } from './branchesController';
import { tenantContext } from '../../middleware/tenantContext';
import { authGuard } from '../../middleware/authGuard';
import { subscriptionGuard } from '../../middleware/subscriptionGuard';
import { requireRoles } from '../../middleware/rbacGuard';
import { RoleType } from '@prisma/client';

const router = Router();
router.use(tenantContext, authGuard);

router.get('/', BranchesController.list);
router.post('/', subscriptionGuard, requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER), BranchesController.create);

export default router;
