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
      const tenantId = req.tenantId!;
      const { garmentTypeId, name, category, description, imageUrl, options, notes } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: { message: 'Style name is required (at least 2 characters)', code: 'INVALID_STYLE_NAME' }
        });
      }

      if (!garmentTypeId || typeof garmentTypeId !== 'string') {
        return res.status(400).json({
          success: false,
          error: { message: 'Garment type is required', code: 'MISSING_GARMENT_TYPE' }
        });
      }

      // Strictly verify garmentType belongs to current tenant
      const garment = await prisma.garmentType.findFirst({
        where: { id: garmentTypeId, tenantId, isActive: true }
      });

      if (!garment) {
        return res.status(400).json({
          success: false,
          error: { message: 'Selected garment type does not exist in your atelier', code: 'INVALID_GARMENT_TYPE' }
        });
      }

      const style = await prisma.style.create({
        data: {
          tenantId,
          garmentTypeId,
          name: name.trim(),
          category: category ? String(category).trim() : 'General',
          description: description ? String(description).trim() : null,
          imageUrl: imageUrl || null,
          options: options || undefined,
          notes: notes ? String(notes).trim() : null
        },
        include: { garmentType: true }
      });

      return res.status(201).json({ success: true, data: style });
    } catch (err) { next(err); }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { id } = req.params;

      const existing = await prisma.style.findFirst({
        where: { id, tenantId }
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: { message: 'Style cut not found', code: 'STYLE_NOT_FOUND' }
        });
      }

      await prisma.style.update({
        where: { id },
        data: { isActive: false }
      });

      return res.json({ success: true, message: 'Style deactivated successfully' });
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
