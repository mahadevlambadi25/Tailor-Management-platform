import { Router } from 'express';
import { PaymentsController } from './paymentsController';
import { tenantContext } from '../../middleware/tenantContext';
import { authGuard } from '../../middleware/authGuard';
import { requireRoles } from '../../middleware/rbacGuard';
import { RoleType } from '@prisma/client';

const router = Router();
router.use(tenantContext, authGuard);

router.get('/', PaymentsController.list);
router.post('/', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.CASHIER, RoleType.RECEPTIONIST), PaymentsController.recordPayment);

export default router;
