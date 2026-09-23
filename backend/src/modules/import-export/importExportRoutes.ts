import { Router } from 'express';
import { ImportExportController } from './importExportController';
import { tenantContext } from '../../middleware/tenantContext';
import { authGuard } from '../../middleware/authGuard';
import { subscriptionGuard } from '../../middleware/subscriptionGuard';
import { requireRoles } from '../../middleware/rbacGuard';
import { RoleType } from '@prisma/client';

const router = Router();
router.use(tenantContext, authGuard);

router.post('/preview', subscriptionGuard, requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER), ImportExportController.previewImport);
router.post('/commit', subscriptionGuard, requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER), ImportExportController.commitImport);
router.get('/export/:entity', requireRoles(RoleType.SHOP_OWNER, RoleType.MANAGER), ImportExportController.exportData);

export default router;
