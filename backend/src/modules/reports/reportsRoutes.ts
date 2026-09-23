import { Router } from 'express';
import { ReportsController } from './reportsController';
import { tenantContext } from '../../middleware/tenantContext';
import { authGuard } from '../../middleware/authGuard';
import { subscriptionGuard } from '../../middleware/subscriptionGuard';
import { requireRoles } from '../../middleware/rbacGuard';
import { RoleType } from '@prisma/client';

const router = Router();
router.use(tenantContext, authGuard, subscriptionGuard);

// ---------------------------------------------------------------------------
// Granular Report Endpoints with RBAC Matrix Guards
// ---------------------------------------------------------------------------
router.get(
  '/overview',
  requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.CASHIER, RoleType.RECEPTIONIST),
  ReportsController.getOverview
);

router.get(
  '/orders',
  requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.RECEPTIONIST),
  ReportsController.getOrderReports
);

router.get(
  '/payments',
  requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.CASHIER),
  ReportsController.getPaymentReports
);

router.get(
  '/production',
  requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.TAILOR, RoleType.CUTTER, RoleType.FINISHER),
  ReportsController.getProductionReports
);

router.get(
  '/customers',
  requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.RECEPTIONIST),
  ReportsController.getCustomerReports
);

router.get(
  '/staff',
  requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER),
  ReportsController.getStaffReports
);

// ---------------------------------------------------------------------------
// Backward-compatible endpoints for existing dashboards
// ---------------------------------------------------------------------------
router.get(
  '/owner-dashboard',
  requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.RECEPTIONIST),
  ReportsController.getOwnerDashboard
);

router.get(
  '/manager-dashboard',
  requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER),
  ReportsController.getManagerDashboard
);

router.get(
  '/tailor-dashboard',
  requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.TAILOR, RoleType.CUTTER, RoleType.FINISHER),
  ReportsController.getTailorDashboard
);

router.get(
  '/analytics',
  requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.CASHIER),
  ReportsController.getAnalytics
);

export default router;
