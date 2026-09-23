import { Router } from 'express';
import { PaymentsController } from './paymentsController';
import { tenantContext } from '../../middleware/tenantContext';
import { authGuard } from '../../middleware/authGuard';
import { subscriptionGuard } from '../../middleware/subscriptionGuard';
import { requireRoles } from '../../middleware/rbacGuard';
import { RoleType } from '@prisma/client';

const router = Router();
router.use(tenantContext, authGuard);

// 1. List payments with search, method, orderId, and customerId filtering
router.get(
  '/',
  requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.CASHIER, RoleType.RECEPTIONIST),
  PaymentsController.list
);

// 2. Get single payment with order, customer, receipt, and staff details
router.get(
  '/:id',
  requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.CASHIER, RoleType.RECEPTIONIST),
  PaymentsController.getById
);

// 3. Record a manual payment against an order
router.post(
  '/',
  subscriptionGuard,
  requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.CASHIER, RoleType.RECEPTIONIST),
  PaymentsController.recordPayment
);

// 4. Cancel / reverse a recorded payment (Restricted strictly to SHOP_OWNER and MANAGER)
router.post(
  '/:id/cancel',
  subscriptionGuard,
  requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER),
  PaymentsController.cancelPayment
);

export default router;
