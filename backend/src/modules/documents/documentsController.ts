import { Request, Response, NextFunction } from 'express';
import QRCode from 'qrcode';
import { prisma } from '../../core/prisma';

export class DocumentsController {
  // Generate QR Code data URL for an Order
  static async getOrderQr(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId } = req.params;
      const tenantId = req.tenantId!;

      const order = await prisma.order.findFirst({
        where: { id: orderId, tenantId },
        include: { tenant: true }
      });

      if (!order) {
        return res.status(404).json({ success: false, error: { message: 'Order not found' } });
      }

      // Verification link embedded in QR
      const verificationUrl = `https://app.tailorpro.internal/verify/order/${order.orderNumber}?tenant=${order.tenant.slug}`;
      const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 250, margin: 1 });

      return res.json({
        success: true,
        data: {
          orderNumber: order.orderNumber,
          verificationUrl,
          qrDataUrl
        }
      });
    } catch (err) { next(err); }
  }

  // Get printable document shell data
  static async getPrintData(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId } = req.params;
      const { docType = 'JOB_CARD' } = req.query; // JOB_CARD, INVOICE, RECEIPT, CUTTING_SHEET, MEASUREMENT_SHEET, DELIVERY_RECEIPT
      const tenantId = req.tenantId!;

      const order = await prisma.order.findFirst({
        where: { id: orderId, tenantId },
        include: {
          tenant: true,
          branch: true,
          customer: true,
          items: {
            include: {
              garmentType: true,
              measurementSnapshot: true,
              styles: { include: { style: true } },
              productionJob: { include: { assignedTo: true } }
            }
          },
          payments: true
        }
      });

      if (!order) {
        return res.status(404).json({ success: false, error: { message: 'Order not found' } });
      }

      const qrDataUrl = await QRCode.toDataURL(order.orderNumber, { width: 180, margin: 1 });

      return res.json({
        success: true,
        data: {
          docType,
          order,
          qrDataUrl,
          generatedAt: new Date()
        }
      });
    } catch (err) { next(err); }
  }
}
