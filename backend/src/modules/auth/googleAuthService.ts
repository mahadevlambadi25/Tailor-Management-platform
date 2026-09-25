import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { RoleType } from '@prisma/client';
import { prisma } from '../../core/prisma';
import { config, ROLE_PERMISSIONS } from '../../config';
import { SubscriptionService } from '../subscriptions/subscriptionService';
import { logger } from '../../core/logger';

export interface GoogleProfile {
  email: string;
  email_verified: boolean;
  name?: string;
  sub?: string;
  picture?: string;
}

export class GoogleAuthService {
  /**
   * Generates the Google OAuth2 authorization URL for the user consent screen.
   */
  static generateGoogleAuthUrl(state?: string): string {
    if (!config.googleClientId) {
      throw new Error('GOOGLE_CLIENT_ID is not configured on the server');
    }

    const params = new URLSearchParams({
      client_id: config.googleClientId,
      redirect_uri: config.googleCallbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account'
    });

    if (state) {
      params.set('state', state);
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchanges an authorization code for Google access & ID tokens.
   */
  static async exchangeCodeForTokens(code: string): Promise<{ id_token: string; access_token: string }> {
    if (!config.googleClientId || !config.googleClientSecret) {
      throw new Error('Google OAuth credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) are not configured');
    }

    const tokenEndpoint = 'https://oauth2.googleapis.com/token';
    const body = new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: config.googleCallbackUrl,
      grant_type: 'authorization_code'
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('Google token exchange failed:', errText);
      throw new Error(`Google token exchange failed with status ${response.status}: ${errText}`);
    }

    const data: any = await response.json();
    return {
      id_token: data.id_token,
      access_token: data.access_token
    };
  }

  /**
   * Verifies an ID token or access token and extracts the Google user profile.
   */
  static async getGoogleProfile(idToken?: string, accessToken?: string): Promise<GoogleProfile> {
    if (idToken) {
      const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
      const response = await fetch(verifyUrl);
      if (response.ok) {
        const data: any = await response.json();
        const isVerified = data.email_verified === 'true' || data.email_verified === true;
        if (!isVerified) {
          throw new Error('Google account email is not verified');
        }
        return {
          email: data.email,
          email_verified: isVerified,
          name: data.name || data.given_name,
          sub: data.sub,
          picture: data.picture
        };
      }
    }

    if (accessToken) {
      const userInfoUrl = 'https://www.googleapis.com/oauth2/v3/userinfo';
      const response = await fetch(userInfoUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (response.ok) {
        const data: any = await response.json();
        const isVerified = data.email_verified === 'true' || data.email_verified === true;
        if (!isVerified) {
          throw new Error('Google account email is not verified');
        }
        return {
          email: data.email,
          email_verified: isVerified,
          name: data.name,
          sub: data.sub,
          picture: data.picture
        };
      }
    }

    throw new Error('Failed to verify Google credentials');
  }

  /**
   * Authenticates an existing user or safely registers a new tenant & user.
   * Preserves tenant isolation and prevents duplicate accounts.
   */
  static async authenticateOrRegisterGoogleUser(
    profile: { email: string; name?: string; sub?: string },
    preferredTenantSlug?: string
  ): Promise<{
    token: string;
    user: {
      id: string;
      name: string;
      email: string;
      role: RoleType;
      branch: { id: string; name: string } | null;
      tenant: { id: string; name: string; slug: string };
    };
    permissions: string[];
    isNewUser: boolean;
  }> {
    const normalizedEmail = profile.email.toLowerCase().trim();

    // 1. Search for existing user with this verified email
    let user = null;
    if (preferredTenantSlug) {
      user = await prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          tenant: { slug: preferredTenantSlug }
        },
        include: { branch: true, tenant: true }
      });
    }

    if (!user) {
      user = await prisma.user.findFirst({
        where: { email: normalizedEmail },
        include: { branch: true, tenant: true }
      });
    }

    // 2. Existing user: Sign in safely without duplicating user or tenant
    if (user) {
      if (!user.tenant.isActive) {
        const err: any = new Error('Tenant subscription is inactive or suspended');
        err.statusCode = 403;
        err.code = 'TENANT_INACTIVE';
        throw err;
      }

      if (!user.isActive) {
        const err: any = new Error('Account has been deactivated');
        err.statusCode = 403;
        err.code = 'ACCOUNT_DEACTIVATED';
        throw err;
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
          entityId: user.id
        }
      });

      // Issue standard JWT
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

      return {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          branch: user.branch ? { id: user.branch.id, name: user.branch.name } : null,
          tenant: { id: user.tenant.id, name: user.tenant.name, slug: user.tenant.slug }
        },
        permissions: ROLE_PERMISSIONS[user.role] || [],
        isNewUser: false
      };
    }

    // 3. New Google user: Provision brand new isolated Tenant, Branch, Subscription, and Shop Owner User
    const rawName = (profile.name || normalizedEmail.split('@')[0] || 'Atelier').trim();
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

    // Cryptographically secure random password hash for OAuth account
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 10);

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
        action: 'GOOGLE_REGISTER',
        entity: 'User',
        entityId: newUser.id
      }
    });

    // Issue standard JWT
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

    return {
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        branch: { id: mainBranch.id, name: mainBranch.name },
        tenant: { id: newTenant.id, name: newTenant.name, slug: newTenant.slug }
      },
      permissions: ROLE_PERMISSIONS[newUser.role] || [],
      isNewUser: true
    };
  }
}
