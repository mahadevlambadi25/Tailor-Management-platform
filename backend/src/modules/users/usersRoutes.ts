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

// 1. Staff change own password (all authenticated users)
router.post('/change-password', UsersController.changeOwnPassword);

// 2. Admin reset staff password
router.patch('/:id/password', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER), UsersController.resetStaffPassword);
router.post('/:id/reset-password', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER), UsersController.resetStaffPassword);

// 3. Admin deactivate / activate staff
router.patch('/:id/status', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER), UsersController.updateStaffStatus);
router.post('/:id/deactivate', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER), (req, res, next) => {
  req.body.isActive = false;
  UsersController.updateStaffStatus(req, res, next);
});
router.post('/:id/activate', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER), (req, res, next) => {
  req.body.isActive = true;
  UsersController.updateStaffStatus(req, res, next);
});

// 4. Admin delete staff (Workspace Owner only)
router.delete('/:id', requireRoles(RoleType.SHOP_OWNER), UsersController.deleteStaff);

export default router;

