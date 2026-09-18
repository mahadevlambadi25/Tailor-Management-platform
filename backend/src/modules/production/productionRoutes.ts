import { Router } from 'express';
import { ProductionController } from './productionController';
import { tenantContext } from '../../middleware/tenantContext';
import { authGuard } from '../../middleware/authGuard';
import { requireRoles } from '../../middleware/rbacGuard';
import { RoleType } from '@prisma/client';

const router = Router();
router.use(tenantContext, authGuard);

router.get('/board', ProductionController.getBoard);
router.post('/jobs/:jobId/assign', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER), ProductionController.assignStaff);
router.post('/jobs/:jobId/stage', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER, RoleType.TAILOR, RoleType.CUTTER, RoleType.FINISHER), ProductionController.updateStage);

export default router;
