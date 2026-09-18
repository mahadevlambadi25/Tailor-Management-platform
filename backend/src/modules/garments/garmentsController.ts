import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/prisma';

export class GarmentsController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const garments = await prisma.garmentType.findMany({
        where: { tenantId: req.tenantId!, isActive: true },
        include: {
          templates: {
            include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } }
          },
          styles: { where: { isActive: true } }
        },
        orderBy: { name: 'asc' }
      });
      return res.json({ success: true, data: garments });
    } catch (err) { next(err); }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, name, category, defaultPrice } = req.body;
      const garment = await prisma.garmentType.create({
        data: {
          tenantId: req.tenantId!,
          code: code.toUpperCase().trim(),
          name: name.trim(),
          category: category.trim(),
          defaultPrice: defaultPrice || 0
        }
      });
      return res.status(201).json({ success: true, data: garment });
    } catch (err) { next(err); }
  }
}
