import { Router } from 'express';
import { UsersController } from './usersController';
import { tenantContext } from '../../middleware/tenantContext';
import { authGuard } from '../../middleware/authGuard';
import { subscriptionGuard } from '../../middleware/subscriptionGuard';
import { requireRoles } from '../../middleware/rbacGuard';
import { RoleType } from '@prisma/client';

const router = Router();
router.use(tenantContext, authGuard);

router.get('/', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.RECEPTIONIST), UsersController.list);
router.post('/', subscriptionGuard, requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER), UsersController.create);

export default router;
