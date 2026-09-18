import { Router } from 'express';
import { UsersController } from './usersController';
import { tenantContext } from '../../middleware/tenantContext';
import { authGuard } from '../../middleware/authGuard';
import { requireRoles } from '../../middleware/rbacGuard';
import { RoleType } from '@prisma/client';

const router = Router();
router.use(tenantContext, authGuard);

router.get('/', UsersController.list);
router.post('/', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER), UsersController.create);

export default router;
