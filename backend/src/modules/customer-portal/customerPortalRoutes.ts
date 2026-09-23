import { Router } from 'express';
import { CustomerPortalController } from './customerPortalController';
import { tenantContext } from '../../middleware/tenantContext';
import { authGuard } from '../../middleware/authGuard';
import { requireRoles } from '../../middleware/rbacGuard';
import { RoleType } from '@prisma/client';

const router = Router();
router.use(tenantContext, authGuard);

const allowedPortalRoles = [
  RoleType.CUSTOMER,
  RoleType.SHOP_OWNER,
  RoleType.MANAGER,
  RoleType.RECEPTIONIST
];

// ---------------------------------------------------------------------------
// Customer Portal Endpoints
// ---------------------------------------------------------------------------
router.get('/dashboard', requireRoles(...allowedPortalRoles), CustomerPortalController.getDashboard);
router.get('/me', requireRoles(...allowedPortalRoles), CustomerPortalController.getDashboard);

router.get('/orders', requireRoles(...allowedPortalRoles), CustomerPortalController.getOrders);
router.get('/orders/:id', requireRoles(...allowedPortalRoles), CustomerPortalController.getOrderById);
router.get('/orders/:id/payments', requireRoles(...allowedPortalRoles), CustomerPortalController.getOrderPayments);

router.get('/measurements', requireRoles(...allowedPortalRoles), CustomerPortalController.getMeasurements);

router.get('/profile', requireRoles(...allowedPortalRoles), CustomerPortalController.getProfile);
router.put('/profile', requireRoles(...allowedPortalRoles), CustomerPortalController.updateProfile);

export default router;
