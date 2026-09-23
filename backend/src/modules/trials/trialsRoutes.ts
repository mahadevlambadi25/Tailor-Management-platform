import { Router } from 'express';
import { TrialsController } from './trialsController';
import { tenantContext } from '../../middleware/tenantContext';
import { authGuard } from '../../middleware/authGuard';
import { subscriptionGuard } from '../../middleware/subscriptionGuard';
import { requireRoles } from '../../middleware/rbacGuard';
import { RoleType } from '@prisma/client';

const router = Router();
router.use(tenantContext, authGuard, subscriptionGuard);

router.get('/', TrialsController.list);
router.post('/', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.TAILOR), TrialsController.create);
router.put('/:id', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.TAILOR), TrialsController.updateStatus);

export default router;
