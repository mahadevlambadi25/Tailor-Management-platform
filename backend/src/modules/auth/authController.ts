import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../core/prisma';
import { config, ROLE_PERMISSIONS } from '../../config';
import { notificationService } from '../notifications/notificationService';
import { NotificationChannel, RoleType } from '@prisma/client';

export class AuthController {
  // Staff Login
  static async staffLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const tenantId = req.tenantId!;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: { message: 'Email and password are required', code: 'MISSING_FIELDS' }
        });
      }

      const user = await prisma.user.findFirst({
        where: {
          tenantId,
          email: email.toLowerCase().trim()
        },
        include: { branch: true, tenant: true }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: { message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' }
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          error: { message: 'Account has been deactivated', code: 'ACCOUNT_DEACTIVATED' }
        });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          error: { message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' }
        });
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: user.id,
          action: 'STAFF_LOGIN',
          entity: 'User',
          entityId: user.id,
          ipAddress: req.ip
        }
      });

      // Create JWT
      const token = jwt.sign(
        {
          id: user.id,
          tenantId: user.tenantId,
          branchId: user.branchId,
          name: user.name,
          email: user.email,
          role: user.role
        },
        config.jwtSecret,
        { expiresIn: '1d' }
      );

      return res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            branch: user.branch ? { id: user.branch.id, name: user.branch.name } : null,
            tenant: { id: user.tenant.id, name: user.tenant.name, slug: user.tenant.slug }
          },
          permissions: ROLE_PERMISSIONS[user.role] || []
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // Get current user profile
  static async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: { message: 'Not authenticated' } });
      }

      if (req.user.role === 'CUSTOMER') {
        const customer = await prisma.customer.findUnique({
          where: { id: req.user.customerId },
          include: { tenant: true }
        });
        return res.json({
          success: true,
          data: {
            user: {
              id: customer?.id,
              customerId: customer?.customerId,
              name: `${customer?.firstName} ${customer?.lastName}`,
              mobile: customer?.mobile,
              role: 'CUSTOMER',
              tenant: customer?.tenant
            },
            permissions: ROLE_PERMISSIONS['CUSTOMER']
          }
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { branch: true, tenant: true }
      });

      if (!user) {
        return res.status(404).json({ success: false, error: { message: 'User not found' } });
      }

      return res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            branch: user.branch ? { id: user.branch.id, name: user.branch.name } : null,
            tenant: { id: user.tenant.id, name: user.tenant.name, slug: user.tenant.slug }
          },
          permissions: ROLE_PERMISSIONS[user.role] || []
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // Customer OTP: Request
  static async requestCustomerOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { mobile } = req.body;
      const tenantId = req.tenantId!;

      if (!mobile) {
        return res.status(400).json({
          success: false,
          error: { message: 'Mobile number is required', code: 'MISSING_MOBILE' }
        });
      }

      // Check customer exists in tenant
      const customer = await prisma.customer.findFirst({
        where: { tenantId, mobile, isDeleted: false }
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: { message: 'No customer account found with this mobile number in this shop.', code: 'CUSTOMER_NOT_FOUND' }
        });
      }

      // Fixed OTP in development/test for reliable testing: "123456"
      const otpCode = process.env.NODE_ENV === 'production' 
        ? Math.floor(100000 + Math.random() * 900000).toString() 
        : '123456';

      const otpHash = await bcrypt.hash(otpCode, 10);
      const expiresAt = new Date(Date.now() + config.otpExpiryMinutes * 60 * 1000);

      // Invalidate existing unused OTPs
      await prisma.customerOtp.updateMany({
        where: { tenantId, mobile, isUsed: false },
        data: { isUsed: true }
      });

      // Save new OTP
      await prisma.customerOtp.create({
        data: {
          tenantId,
          mobile,
          otpHash,
          expiresAt
        }
      });

      // Trigger notification
      await notificationService.send({
        tenantId,
        customerId: customer.id,
        eventType: 'CUSTOMER_OTP',
        recipient: mobile,
        channel: NotificationChannel.SMS,
        title: 'Customer Portal Login OTP',
        message: `Your verification code for ${req.tenant.name} is ${otpCode}. Valid for ${config.otpExpiryMinutes} minutes.`
      });

      return res.json({
        success: true,
        data: {
          message: 'OTP sent successfully to registered mobile number',
          mobile,
          expiresInMinutes: config.otpExpiryMinutes,
          devOtp: process.env.NODE_ENV !== 'production' ? otpCode : undefined
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // Customer OTP: Verify
  static async verifyCustomerOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { mobile, otp } = req.body;
      const tenantId = req.tenantId!;

      if (!mobile || !otp) {
        return res.status(400).json({
          success: false,
          error: { message: 'Mobile and OTP are required', code: 'MISSING_FIELDS' }
        });
      }

      const otpRecord = await prisma.customerOtp.findFirst({
        where: {
          tenantId,
          mobile,
          isUsed: false,
          expiresAt: { gt: new Date() }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!otpRecord) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid or expired OTP', code: 'OTP_EXPIRED' }
        });
      }

      if (otpRecord.attempts >= config.otpMaxAttempts) {
        await prisma.customerOtp.update({
          where: { id: otpRecord.id },
          data: { isUsed: true }
        });
        return res.status(429).json({
          success: false,
          error: { message: 'Maximum OTP verification attempts exceeded. Please request a new OTP.', code: 'OTP_MAX_ATTEMPTS' }
        });
      }

      const isMatch = await bcrypt.compare(otp, otpRecord.otpHash);
      if (!isMatch) {
        await prisma.customerOtp.update({
          where: { id: otpRecord.id },
          data: { attempts: otpRecord.attempts + 1 }
        });
        return res.status(400).json({
          success: false,
          error: { message: 'Incorrect OTP code', code: 'OTP_INCORRECT' }
        });
      }

      // Mark OTP as used
      await prisma.customerOtp.update({
        where: { id: otpRecord.id },
        data: { isUsed: true }
      });

      // Find Customer
      const customer = await prisma.customer.findFirst({
        where: { tenantId, mobile, isDeleted: false },
        include: { tenant: true }
      });

      if (!customer) {
        return res.status(404).json({ success: false, error: { message: 'Customer record missing' } });
      }

      // Generate customer-scoped token
      const token = jwt.sign(
        {
          id: customer.id,
          customerId: customer.id,
          tenantId: customer.tenantId,
          name: `${customer.firstName} ${customer.lastName}`,
          mobile: customer.mobile,
          role: 'CUSTOMER'
        },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        data: {
          token,
          customer: {
            id: customer.id,
            customerId: customer.customerId,
            firstName: customer.firstName,
            lastName: customer.lastName,
            mobile: customer.mobile,
            tenant: { id: customer.tenant.id, name: customer.tenant.name, slug: customer.tenant.slug }
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }
}
