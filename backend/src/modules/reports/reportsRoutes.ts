import { Router } from 'express';
import { ReportsController } from './reportsController';
import { tenantContext } from '../../middleware/tenantContext';
import { authGuard } from '../../middleware/authGuard';
import { requireRoles } from '../../middleware/rbacGuard';
import { RoleType } from '@prisma/client';

const router = Router();
router.use(tenantContext, authGuard);

router.get('/owner-dashboard', requireRoles(RoleType.SHOP_OWNER), ReportsController.getOwnerDashboard);
router.get('/manager-dashboard', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER), ReportsController.getManagerDashboard);
router.get('/tailor-dashboard', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.TAILOR, RoleType.CUTTER, RoleType.FINISHER), ReportsController.getTailorDashboard);
router.get('/analytics', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.CASHIER), ReportsController.getAnalytics);

export default router;
