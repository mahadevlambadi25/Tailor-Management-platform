import { Router } from 'express';
import { StylesController } from './stylesController';
import { tenantContext } from '../../middleware/tenantContext';
import { authGuard } from '../../middleware/authGuard';
import { subscriptionGuard } from '../../middleware/subscriptionGuard';
import { requireRoles } from '../../middleware/rbacGuard';
import { RoleType } from '@prisma/client';

const router = Router();
router.use(tenantContext, authGuard, subscriptionGuard);

router.get('/', StylesController.list);
router.post('/', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER), StylesController.create);
router.post('/favourites', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.RECEPTIONIST), StylesController.toggleCustomerFavourite);

export default router;
