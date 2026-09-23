import { Router } from 'express';
import { OrdersController } from './ordersController';
import { PaymentsController } from '../payments/paymentsController';
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
    RoleType.TAILOR,
    RoleType.CUTTER,
    RoleType.CASHIER,
    RoleType.FINISHER
  ),
  OrdersController.list
);
router.get(
  '/:id',
  requireRoles(
    RoleType.SHOP_OWNER,
    RoleType.MANAGER,
    RoleType.RECEPTIONIST,
    RoleType.TAILOR,
    RoleType.CUTTER,
    RoleType.CASHIER,
    RoleType.FINISHER
  ),
  OrdersController.getById
);
router.post('/', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.RECEPTIONIST), OrdersController.create);
router.patch('/:id/status', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.RECEPTIONIST, RoleType.TAILOR), OrdersController.updateStatus);
router.put('/:id', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.RECEPTIONIST), OrdersController.update);

// Order-Scoped Payments Endpoints
router.get(
  '/:orderId/payments',
  requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.CASHIER, RoleType.RECEPTIONIST),
  PaymentsController.getOrderPayments
);
router.post(
  '/:orderId/payments',
  requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.CASHIER, RoleType.RECEPTIONIST),
  PaymentsController.recordOrderPayment
);

export default router;
