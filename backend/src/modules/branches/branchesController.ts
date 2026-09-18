import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/prisma';

export class BranchesController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const branches = await prisma.branch.findMany({
        where: { tenantId: req.tenantId!, isActive: true },
        orderBy: { isMain: 'desc' }
      });
      return res.json({ success: true, data: branches });
    } catch (err) { next(err); }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, code, phone, address, isMain } = req.body;
      const branch = await prisma.branch.create({
        data: {
          tenantId: req.tenantId!,
          name,
          code,
          phone,
          address,
          isMain: isMain || false
        }
      });
      return res.json({ success: true, data: branch });
    } catch (err) { next(err); }
  }
}
