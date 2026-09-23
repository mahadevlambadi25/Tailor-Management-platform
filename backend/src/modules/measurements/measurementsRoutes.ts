import { Router } from 'express';
import { MeasurementsController } from './measurementsController';
import { tenantContext } from '../../middleware/tenantContext';
import { authGuard } from '../../middleware/authGuard';
import { subscriptionGuard } from '../../middleware/subscriptionGuard';
import { requireRoles } from '../../middleware/rbacGuard';
import { RoleType } from '@prisma/client';

const router = Router();
router.use(tenantContext, authGuard, subscriptionGuard);

router.post('/', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.RECEPTIONIST, RoleType.TAILOR), MeasurementsController.saveCustomerMeasurement);
router.get('/customer/:customerId', MeasurementsController.getByCustomer);

export default router;
