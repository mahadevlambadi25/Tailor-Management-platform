import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../core/prisma';
import { config, ROLE_PERMISSIONS } from '../../config';
import { notificationService } from '../notifications/notificationService';
import { NotificationChannel, RoleType } from '@prisma/client';
import { GoogleAuthService } from './googleAuthService';
import { SubscriptionService } from '../subscriptions/subscriptionService';

export class AuthController {
  // Staff Login
  static async staffLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      let tenantId = req.tenantId;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: { message: 'Email and password are required', code: 'MISSING_FIELDS' }
        });
      }

      // Check if client explicitly supplied a tenant slug in body or header
      const clientProvidedSlug = req.body?.tenantSlug || (req.headers['x-tenant-slug'] ? String(req.headers['x-tenant-slug']).trim() : '');
      const hasExplicitSlug = !!clientProvidedSlug;

      let user = null;
      if (hasExplicitSlug && tenantId) {
        user = await prisma.user.findFirst({
          where: {
            tenantId,
            email: email.toLowerCase().trim()
          },
          include: { branch: true, tenant: true }
        });
      } else {
        // Auto-resolve workspace by email
        const candidateUsers = await prisma.user.findMany({
          where: {
            email: email.toLowerCase().trim()
          },
          include: { branch: true, tenant: true }
        });

        // Filter valid workspaces where credentials match
        const matchedUsers: typeof candidateUsers = [];
        for (const candidate of candidateUsers) {
          if (candidate.isActive && candidate.tenant.isActive) {
            const isMatch = await bcrypt.compare(password, candidate.passwordHash);
            if (isMatch) {
              matchedUsers.push(candidate);
            }
          }
        }

        if (matchedUsers.length > 1) {
          // Multiple workspaces detected -> present workspace selection screen
          return res.json({
            success: true,
            requiresWorkspaceSelection: true,
            workspaces: matchedUsers.map((u) => ({
              tenantId: u.tenant.id,
              tenantName: u.tenant.name,
              tenantSlug: u.tenant.slug,
              branchName: u.branch?.name || 'Main Atelier',
              role: u.role
            }))
          });
        } else if (matchedUsers.length === 1) {
          user = matchedUsers[0];
          tenantId = user.tenantId;
        } else if (candidateUsers.length > 0) {
          user = candidateUsers[0];
        }
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          error: { message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' }
        });
      }

      if (!user.tenant.isActive) {
        return res.status(403).json({
          success: false,
          error: { message: 'Tenant subscription is inactive or suspended', code: 'TENANT_INACTIVE' }
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
          tenantId: user.tenantId,
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

  // Staff / Atelier Owner Registration
  static async staffRegister(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, password, confirmPassword } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          error: { message: 'Name, email, and password are required', code: 'MISSING_FIELDS' }
        });
      }

      if (confirmPassword && password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          error: { message: 'Passwords do not match', code: 'PASSWORD_MISMATCH' }
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          error: { message: 'Password must be at least 6 characters long', code: 'PASSWORD_TOO_SHORT' }
        });
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: { email: normalizedEmail }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: { message: 'An account with this email already exists. Please sign in instead.', code: 'EMAIL_ALREADY_EXISTS' }
        });
      }

      // Provision new Tenant, Branch, Subscription, and Shop Owner User
      const rawName = name.trim();
      const slugBase = rawName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'atelier';
      const uniqueSuffix = crypto.randomBytes(3).toString('hex');
      const newSlug = `${slugBase}-${uniqueSuffix}`;

      const newTenant = await prisma.tenant.create({
        data: {
          name: `${rawName}'s Atelier`,
          slug: newSlug,
          phone: '+91 9999999999',
          email: normalizedEmail,
          currency: 'INR',
          isDemo: false,
          isActive: true
        }
      });

      const mainBranch = await prisma.branch.create({
        data: {
          tenantId: newTenant.id,
          name: 'Main Workshop',
          code: 'HQ-01',
          isMain: true,
          isActive: true
        }
      });

      // Initialize unused-trial subscription (PENDING, trialUsed: false)
      await SubscriptionService.createInitialSubscription(newTenant.id);

      const passwordHash = await bcrypt.hash(password, 10);

      const newUser = await prisma.user.create({
        data: {
          tenantId: newTenant.id,
          branchId: mainBranch.id,
          name: rawName,
          email: normalizedEmail,
          role: RoleType.SHOP_OWNER,
          passwordHash,
          isActive: true,
          lastLoginAt: new Date()
        },
        include: {
          branch: true,
          tenant: true
        }
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          tenantId: newTenant.id,
          userId: newUser.id,
          action: 'STAFF_REGISTER',
          entity: 'User',
          entityId: newUser.id,
          ipAddress: req.ip
        }
      });

      // Create JWT
      const token = jwt.sign(
        {
          id: newUser.id,
          tenantId: newUser.tenantId,
          branchId: newUser.branchId,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role
        },
        config.jwtSecret,
        { expiresIn: '1d' }
      );

      return res.status(201).json({
        success: true,
        data: {
          token,
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            branch: { id: mainBranch.id, name: mainBranch.name },
            tenant: { id: newTenant.id, name: newTenant.name, slug: newTenant.slug }
          },
          permissions: ROLE_PERMISSIONS[newUser.role] || []
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
        const newAttempts = otpRecord.attempts + 1;
        const reachedMax = newAttempts >= config.otpMaxAttempts;
        await prisma.customerOtp.update({
          where: { id: otpRecord.id },
          data: {
            attempts: newAttempts,
            ...(reachedMax ? { isUsed: true } : {})
          }
        });

        if (reachedMax) {
          return res.status(429).json({
            success: false,
            error: { message: 'Maximum OTP verification attempts exceeded. Please request a new OTP.', code: 'OTP_MAX_ATTEMPTS' }
          });
        }

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

  // Initiate Google OAuth Redirect
  static async googleRedirect(req: Request, res: Response, next: NextFunction) {
    try {
      if (!config.googleClientId) {
        if (req.headers.accept?.includes('application/json') || req.query.format === 'json') {
          return res.status(503).json({
            success: false,
            error: {
              message: 'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
              code: 'GOOGLE_OAUTH_NOT_CONFIGURED'
            }
          });
        }
        return res.redirect(`${config.frontendUrl}/login?error=GOOGLE_OAUTH_NOT_CONFIGURED`);
      }

      // Preserve tenantSlug in state if provided
      const tenantSlug = (req.query.tenantSlug as string) || (req.headers['x-tenant-slug'] as string) || '';
      const stateObj = { tenantSlug, timestamp: Date.now() };
      const state = Buffer.from(JSON.stringify(stateObj)).toString('base64');

      const authUrl = GoogleAuthService.generateGoogleAuthUrl(state);
      return res.redirect(authUrl);
    } catch (err) {
      next(err);
    }
  }

  // Google OAuth Callback
  static async googleCallback(req: Request, res: Response, _next: NextFunction) {
    try {
      const { code, state, error: oauthError } = req.query;

      if (oauthError) {
        return res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(String(oauthError))}`);
      }

      if (!code || typeof code !== 'string') {
        return res.redirect(`${config.frontendUrl}/login?error=MISSING_OAUTH_CODE`);
      }

      // Parse state
      let tenantSlug: string | undefined;
      if (state && typeof state === 'string') {
        try {
          const parsedState = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
          tenantSlug = parsedState.tenantSlug;
        } catch {
          // ignore state parse errors
        }
      }

      // Exchange code for tokens
      const tokens = await GoogleAuthService.exchangeCodeForTokens(code);

      // Verify and extract profile
      const profile = await GoogleAuthService.getGoogleProfile(tokens.id_token, tokens.access_token);

      // Authenticate or safely register user
      const result = await GoogleAuthService.authenticateOrRegisterGoogleUser(profile, tenantSlug);

      // Redirect back to frontend with token
      const redirectUrl = `${config.frontendUrl}/login?token=${encodeURIComponent(result.token)}&slug=${encodeURIComponent(result.user.tenant.slug)}`;
      return res.redirect(redirectUrl);
    } catch (err: any) {
      const message = err.message || 'Google authentication failed';
      return res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(message)}`);
    }
  }

  // Direct Google ID Token / Credential Verification
  static async googleTokenLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { credential, idToken, accessToken, tenantSlug } = req.body;
      const tokenToVerify = credential || idToken;

      if (!tokenToVerify && !accessToken) {
        return res.status(400).json({
          success: false,
          error: { message: 'Google credential or token is required', code: 'MISSING_CREDENTIALS' }
        });
      }

      const profile = await GoogleAuthService.getGoogleProfile(tokenToVerify, accessToken);
      const result = await GoogleAuthService.authenticateOrRegisterGoogleUser(profile, tenantSlug);

      return res.json({
        success: true,
        data: result
      });
    } catch (err: any) {
      const statusCode = err.statusCode || (err.code === 'TENANT_INACTIVE' || err.code === 'ACCOUNT_DEACTIVATED' ? 403 : 400);
      return res.status(statusCode).json({
        success: false,
        error: { message: err.message || 'Google authentication failed', code: err.code || 'GOOGLE_AUTH_FAILED' }
      });
    }
  }
}
