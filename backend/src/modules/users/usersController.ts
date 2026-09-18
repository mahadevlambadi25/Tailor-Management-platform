import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../core/prisma';
import { RoleType } from '@prisma/client';

export class UsersController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const users = await prisma.user.findMany({
        where: { tenantId: req.tenantId!, isActive: true },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          staffCode: true,
          skills: true,
          branch: { select: { id: true, name: true } },
          lastLoginAt: true,
          createdAt: true
        },
        orderBy: { name: 'asc' }
      });
      return res.json({ success: true, data: users });
    } catch (err) { next(err); }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, phone, role, password, branchId, staffCode, skills } = req.body;
      if (!name || !email || !password || !role) {
        return res.status(400).json({ success: false, error: { message: 'Missing required staff fields' } });
      }

      const existing = await prisma.user.findFirst({
        where: { tenantId: req.tenantId!, email: email.toLowerCase().trim() }
      });
      if (existing) {
        return res.status(400).json({ success: false, error: { message: 'Staff with this email already exists' } });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          tenantId: req.tenantId!,
          name,
          email: email.toLowerCase().trim(),
          phone,
          role: role as RoleType,
          passwordHash,
          branchId: branchId || null,
          staffCode,
          skills: skills || []
        },
        select: { id: true, name: true, email: true, role: true, staffCode: true }
      });

      return res.status(201).json({ success: true, data: user });
    } catch (err) { next(err); }
  }
}
