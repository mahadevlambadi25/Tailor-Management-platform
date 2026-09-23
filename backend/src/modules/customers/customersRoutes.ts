import { Router } from 'express';
import { CustomersController } from './customersController';
import { tenantContext } from '../../middleware/tenantContext';
import { authGuard } from '../../middleware/authGuard';
import { subscriptionGuard } from '../../middleware/subscriptionGuard';
import { requireRoles } from '../../middleware/rbacGuard';
import { RoleType } from '@prisma/client';

const router = Router();
router.use(tenantContext, authGuard, subscriptionGuard);

router.get(
  '/',
  requireRoles(
    RoleType.SHOP_OWNER,
    RoleType.MANAGER,
    RoleType.RECEPTIONIST,
    RoleType.CASHIER,
    RoleType.TAILOR,
    RoleType.CUTTER,
    RoleType.FINISHER
  ),
  CustomersController.list
);
router.post('/', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.RECEPTIONIST), CustomersController.create);
router.get(
  '/:id',
  requireRoles(
    RoleType.SHOP_OWNER,
    RoleType.MANAGER,
    RoleType.RECEPTIONIST,
    RoleType.CASHIER,
    RoleType.TAILOR,
    RoleType.CUTTER,
    RoleType.FINISHER
  ),
  CustomersController.getById
);
router.put('/:id', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.RECEPTIONIST), CustomersController.update);
router.delete('/:id', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER), CustomersController.softDelete);
router.post('/:id/restore', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER), CustomersController.restore);
router.put('/:id/preferences', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.RECEPTIONIST), CustomersController.updatePreferences);

export default router;
