import { Router } from 'express';
import { DocumentsController } from './documentsController';
import { tenantContext } from '../../middleware/tenantContext';
import { authGuard } from '../../middleware/authGuard';

const router = Router();
router.use(tenantContext, authGuard);

router.get('/orders/:orderId/qr', DocumentsController.getOrderQr);
router.get('/orders/:orderId/print', DocumentsController.getPrintData);

export default router;
