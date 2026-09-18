import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/prisma';

export class AlterationsController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderItemId } = req.query;
      const alterations = await prisma.alteration.findMany({
        where: {
          tenantId: req.tenantId!,
          orderItemId: orderItemId ? (orderItemId as string) : undefined
        },
        include: {
          assignedTo: { select: { id: true, name: true } },
          customer: { select: { firstName: true, lastName: true } },
          orderItem: { include: { garmentType: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.json({ success: true, data: alterations });
    } catch (err) { next(err); }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, assignedToId } = req.body;
      const alt = await prisma.alteration.update({
        where: { id, tenantId: req.tenantId! },
        data: { status, assignedToId }
      });
      return res.json({ success: true, data: alt });
    } catch (err) { next(err); }
  }
}
