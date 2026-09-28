import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../../core/prisma';
import { provisionDefaultGarmentsForTenant } from './garmentCatalogService';
import { UnitSystem } from '@prisma/client';

export class GarmentsController {
  /**
   * List all active garment types for the authenticated tenant.
   * If the tenant does not have any garment types configured yet,
   * automatically and idempotently provisions the standard garment catalog.
   */
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;

      let garments = await prisma.garmentType.findMany({
        where: { tenantId, isActive: true },
        include: {
          templates: {
            include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } }
          },
          styles: { where: { isActive: true } }
        },
        orderBy: { name: 'asc' }
      });

      // Self-healing / Onboarding: If workspace has 0 garment types, provision master catalog
      if (garments.length === 0) {
        await provisionDefaultGarmentsForTenant(tenantId);
        garments = await prisma.garmentType.findMany({
          where: { tenantId, isActive: true },
          include: {
            templates: {
              include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } }
            },
            styles: { where: { isActive: true } }
          },
          orderBy: { name: 'asc' }
        });
      }

      return res.json({ success: true, data: garments });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create a new custom garment type for the authenticated tenant.
   */
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { code, name, category, defaultPrice } = req.body;

      // 1. Validate Name
      const trimmedName = typeof name === 'string' ? name.trim() : '';
      if (!trimmedName || trimmedName.length < 2) {
        return res.status(400).json({
          success: false,
          error: { message: 'Garment name is required (at least 2 characters)', code: 'INVALID_GARMENT_NAME' }
        });
      }

      // 2. Validate or auto-generate code
      let normalizedCode = typeof code === 'string' && code.trim().length > 0
        ? code.toUpperCase().trim().replace(/[^A-Z0-9_-]/g, '_')
        : trimmedName.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 12);

      if (!normalizedCode) {
        normalizedCode = `GARMENT_${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      }

      // 3. Category
      const normalizedCategory = typeof category === 'string' && category.trim().length > 0
        ? category.trim()
        : 'Men';

      // 4. Default Price
      const parsedPrice = Number(defaultPrice) >= 0 ? Number(defaultPrice) : 0;

      // 5. Check duplicate within tenant
      const existing = await prisma.garmentType.findFirst({
        where: { tenantId, code: normalizedCode }
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          error: {
            message: `A garment type with code "${normalizedCode}" already exists in your atelier. Please choose a different code.`,
            code: 'DUPLICATE_GARMENT_CODE'
          }
        });
      }

      // 6. Create Garment Type
      const garment = await prisma.garmentType.create({
        data: {
          tenantId,
          code: normalizedCode,
          name: trimmedName,
          category: normalizedCategory,
          defaultPrice: parsedPrice,
          isActive: true
        }
      });

      // 7. Auto-create standard starter measurement template for this garment
      await prisma.measurementTemplate.create({
        data: {
          tenantId,
          garmentTypeId: garment.id,
          name: `${trimmedName} Template`,
          unit: UnitSystem.INCHES,
          versions: {
            create: {
              versionNumber: 1,
              fields: [
                { key: 'Length', label: 'Total Length', min: 10, max: 60, required: true },
                { key: 'Chest_Bust', label: 'Chest / Bust', min: 20, max: 65, required: true },
                { key: 'Waist', label: 'Waist', min: 20, max: 60, required: true },
                { key: 'Shoulder', label: 'Shoulder Width', min: 10, max: 30, required: false }
              ]
            }
          }
        }
      }).catch(() => {});

      // 8. Audit Log
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: req.user?.id,
          action: 'GARMENT_TYPE_CREATED',
          entity: 'GarmentType',
          entityId: garment.id,
          details: { name: garment.name, code: garment.code, category: garment.category }
        }
      }).catch(() => {});

      return res.status(201).json({ success: true, data: garment });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update an existing garment type
   */
  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { id } = req.params;
      const { name, category, defaultPrice, isActive } = req.body;

      const existing = await prisma.garmentType.findFirst({
        where: { id, tenantId }
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: { message: 'Garment type not found in your atelier', code: 'GARMENT_NOT_FOUND' }
        });
      }

      const updated = await prisma.garmentType.update({
        where: { id },
        data: {
          name: typeof name === 'string' && name.trim() ? name.trim() : existing.name,
          category: typeof category === 'string' && category.trim() ? category.trim() : existing.category,
          defaultPrice: defaultPrice !== undefined ? Number(defaultPrice) : existing.defaultPrice,
          isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive
        }
      });

      return res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Soft-deactivate a garment type
   */
  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { id } = req.params;

      const existing = await prisma.garmentType.findFirst({
        where: { id, tenantId }
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: { message: 'Garment type not found', code: 'GARMENT_NOT_FOUND' }
        });
      }

      // Check if orders use this garment type
      const orderCount = await prisma.orderItem.count({
        where: { garmentTypeId: id }
      });

      if (orderCount > 0) {
        // Soft delete / deactivate so historical orders remain valid
        await prisma.garmentType.update({
          where: { id },
          data: { isActive: false }
        });
        return res.json({ success: true, message: 'Garment type deactivated (historical orders preserved)' });
      }

      // If no orders ever used it, can safely delete
      await prisma.garmentType.delete({
        where: { id }
      });

      return res.json({ success: true, message: 'Garment type deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}
