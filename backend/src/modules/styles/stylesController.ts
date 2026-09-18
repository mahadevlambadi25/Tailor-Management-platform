import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/prisma';

export class StylesController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { garmentTypeId } = req.query;
      const styles = await prisma.style.findMany({
        where: {
          tenantId: req.tenantId!,
          isActive: true,
          garmentTypeId: garmentTypeId ? (garmentTypeId as string) : undefined
        },
        include: { garmentType: true },
        orderBy: { name: 'asc' }
      });
      return res.json({ success: true, data: styles });
    } catch (err) { next(err); }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { garmentTypeId, name, category, description, imageUrl, options, notes } = req.body;
      const style = await prisma.style.create({
        data: {
          tenantId: req.tenantId!,
          garmentTypeId,
          name,
          category,
          description,
          imageUrl,
          options,
          notes
        }
      });
      return res.status(201).json({ success: true, data: style });
    } catch (err) { next(err); }
  }

  static async toggleCustomerFavourite(req: Request, res: Response, next: NextFunction) {
    try {
      const { customerId, styleId, isFavourite } = req.body;
      const tenantId = req.tenantId!;

      const fav = await prisma.customerStyle.upsert({
        where: { customerId_styleId: { customerId, styleId } },
        update: { isFavourite },
        create: { tenantId, customerId, styleId, isFavourite }
      });

      return res.json({ success: true, data: fav });
    } catch (err) { next(err); }
  }
}
