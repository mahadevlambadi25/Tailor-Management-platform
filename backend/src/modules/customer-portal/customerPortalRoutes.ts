import { Router } from 'express';
import { CustomerPortalController } from './customerPortalController';
import { tenantContext } from '../../middleware/tenantContext';
import { authGuard } from '../../middleware/authGuard';
import { requireRoles } from '../../middleware/rbacGuard';
import { RoleType } from '@prisma/client';
import { prisma } from '../../core/prisma';

const router = Router();
router.use(tenantContext, authGuard);

const allowedPortalRoles = [
  RoleType.CUSTOMER, 
  RoleType.SHOP_OWNER, 
  RoleType.MANAGER, 
  RoleType.RECEPTIONIST
];

router.get('/me', requireRoles(...allowedPortalRoles), CustomerPortalController.getMyPortal);

router.get('/orders', requireRoles(...allowedPortalRoles), async (req, res, next) => {
  try {
    let customerId = req.user?.customerId;
    if (!customerId) {
      const firstCust = await prisma.customer.findFirst({
        where: { tenantId: req.tenantId!, isDeleted: false }
      });
      customerId = firstCust?.id;
    }
    if (!customerId) return res.json({ success: true, data: [] });

    const orders = await prisma.order.findMany({
      where: { customerId, tenantId: req.tenantId! },
      include: {
        items: {
          include: {
            garmentType: { select: { name: true, category: true } },
            measurementSnapshot: true
          }
        },
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Sanitize: strictly strip internal notes and delay reason
    const sanitized = orders.map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      createdAt: o.createdAt,
      deliveryDueDate: o.deliveryDate,
      status: o.status,
      paymentStatus: o.paymentStatus,
      grandTotal: Number(o.totalAmount),
      advancePaid: Number(o.paidAmount),
      balanceDue: Number(o.balanceAmount),
      customerRemarks: o.customerNotes,
      items: o.items.map((item, idx) => ({
        id: item.id,
        itemNumber: `ITEM-${idx + 1}`,
        garmentType: item.garmentType,
        styleOptions: {},
        status: item.status,
        unitPrice: Number(item.itemPrice)
      }))
    }));

    return res.json({ success: true, data: sanitized });
  } catch (err) {
    next(err);
  }
});

router.get('/measurements', requireRoles(...allowedPortalRoles), async (req, res, next) => {
  try {
    let customerId = req.user?.customerId;
    if (!customerId) {
      const firstCust = await prisma.customer.findFirst({
        where: { tenantId: req.tenantId!, isDeleted: false }
      });
      customerId = firstCust?.id;
    }
    if (!customerId) return res.json({ success: true, data: [] });

    const measurements = await prisma.customerMeasurement.findMany({
      where: { customerId, tenantId: req.tenantId! },
      include: {
        garmentType: { select: { name: true, category: true } },
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 }
      }
    });

    const mapped = measurements.map(m => ({
      id: m.id,
      garmentType: m.garmentType,
      values: (m.versions[0]?.values as any) || {},
      isApproved: true,
      updatedAt: m.updatedAt
    }));

    return res.json({ success: true, data: mapped });
  } catch (err) {
    next(err);
  }
});

export default router;
