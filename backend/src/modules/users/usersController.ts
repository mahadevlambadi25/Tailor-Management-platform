import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../core/prisma';
import { RoleType } from '@prisma/client';
import crypto from 'crypto';
import { config } from '../../config';
import { track } from '../conversion/funnelService';

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

      // 1. Validate full name
      const trimmedName = typeof name === 'string' ? name.trim() : '';
      if (!trimmedName || trimmedName.length < 2) {
        return res.status(400).json({
          success: false,
          error: { message: 'Full name is required (at least 2 characters)', code: 'INVALID_NAME' }
        });
      }

      // 2. Validate email format
      const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : '';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          error: { message: 'A valid email address is required', code: 'INVALID_EMAIL' }
        });
      }

      // 3. Validate role
      const validRoles: RoleType[] = [
        RoleType.SHOP_OWNER,
        RoleType.MANAGER,
        RoleType.RECEPTIONIST,
        RoleType.TAILOR,
        RoleType.CUTTER,
        RoleType.FINISHER,
        RoleType.CASHIER
      ];
      if (!role || !validRoles.includes(role as RoleType)) {
        return res.status(400).json({
          success: false,
          error: { message: 'A valid system role is required', code: 'INVALID_ROLE' }
        });
      }

      // 4. Validate branch belongs to current tenant if supplied
      let validatedBranchId: string | null = null;
      if (branchId) {
        const branch = await prisma.branch.findFirst({
          where: { id: branchId, tenantId: req.tenantId! }
        });
        if (!branch) {
          return res.status(400).json({
            success: false,
            error: { message: 'Selected branch does not belong to your atelier', code: 'INVALID_BRANCH' }
          });
        }
        validatedBranchId = branch.id;
      }

      // 5. Handle password / temporary password flow
      let tempPassword = typeof password === 'string' ? password.trim() : '';
      if (!tempPassword) {
        // Auto-generate strong, clean temporary password
        const randomHex = crypto.randomBytes(3).toString('hex');
        tempPassword = `Tailor@${randomHex}!`;
      } else if (tempPassword.length < 6) {
        return res.status(400).json({
          success: false,
          error: { message: 'Password must be at least 6 characters long', code: 'PASSWORD_TOO_SHORT' }
        });
      }

      // 6. Check duplicate staff email in this tenant
      const existing = await prisma.user.findFirst({
        where: { tenantId: req.tenantId!, email: normalizedEmail }
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'A staff member with this email already exists in your atelier',
            code: 'DUPLICATE_STAFF_EMAIL'
          }
        });
      }

      // 7. Secure password hashing
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      // Normalize skills
      const parsedSkills: string[] = Array.isArray(skills)
        ? skills.map(s => String(s).trim()).filter(Boolean)
        : typeof skills === 'string'
        ? skills.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const user = await prisma.user.create({
        data: {
          tenantId: req.tenantId!,
          name: trimmedName,
          email: normalizedEmail,
          phone: phone ? String(phone).trim() : null,
          role: role as RoleType,
          passwordHash,
          branchId: validatedBranchId,
          staffCode: staffCode ? String(staffCode).trim() : null,
          skills: parsedSkills
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          staffCode: true,
          branchId: true,
          isSample: true,
          createdAt: true
        }
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          tenantId: req.tenantId!,
          userId: req.user?.id,
          action: 'STAFF_CREATED',
          entity: 'User',
          entityId: user.id,
          details: { role: user.role, branchId: user.branchId, email: user.email }
        }
      }).catch(() => {});

      // Conversion V1: Track staff_invited
      if (config.conversionV1 && !user.isSample) {
        await track(req.tenantId!, 'staff_invited', {
          role: user.role,
          staffId: user.id
        }, req.user?.id);
      }

      return res.status(201).json({
        success: true,
        message: 'Staff account created successfully.',
        data: {
          ...user,
          temporaryPassword: tempPassword
        },
        temporaryPassword: tempPassword
      });
    } catch (err) { next(err); }
  }
}
