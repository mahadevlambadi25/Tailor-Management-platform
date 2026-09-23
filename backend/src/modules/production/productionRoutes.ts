import { Router } from 'express';
import { ProductionController } from './productionController';
import { tenantContext } from '../../middleware/tenantContext';
import { authGuard } from '../../middleware/authGuard';
import { subscriptionGuard } from '../../middleware/subscriptionGuard';
import { requireRoles } from '../../middleware/rbacGuard';
import { RoleType } from '@prisma/client';

const router = Router();
router.use(tenantContext, authGuard, subscriptionGuard);

// 1. Production Board with search, stage filter, delayed, priority, staff, and role filtering
router.get(
  '/board',
  requireRoles(
    RoleType.SHOP_OWNER,
    RoleType.MANAGER,
    RoleType.TAILOR,
    RoleType.CUTTER,
    RoleType.FINISHER,
    RoleType.RECEPTIONIST
  ),
  ProductionController.getBoard
);

// 2. Production Job Details with immutable measurement snapshot and timeline
router.get(
  '/jobs/:jobId',
  requireRoles(
    RoleType.SHOP_OWNER,
    RoleType.MANAGER,
    RoleType.TAILOR,
    RoleType.CUTTER,
    RoleType.FINISHER,
    RoleType.RECEPTIONIST
  ),
  ProductionController.getJobById
);

// 3. Staff Assignment (Cutter, Tailor, Finisher)
router.post(
  '/jobs/:jobId/assign',
  requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER),
  ProductionController.assignStaff
);

// 4. Update Production Stage with transition validation and delay reason enforcement
router.post(
  '/jobs/:jobId/stage',
  requireRoles(
    RoleType.SHOP_OWNER,
    RoleType.MANAGER,
    RoleType.TAILOR,
    RoleType.CUTTER,
    RoleType.FINISHER,
    RoleType.RECEPTIONIST
  ),
  ProductionController.updateStage
);

// 5. Customer Returned for Alteration (Explicit action for DELIVERED -> ALTERATION)
router.post(
  '/jobs/:jobId/return-for-alteration',
  requireRoles(
    RoleType.SHOP_OWNER,
    RoleType.MANAGER,
    RoleType.RECEPTIONIST,
    RoleType.TAILOR
  ),
  ProductionController.returnForAlteration
);

export default router;
