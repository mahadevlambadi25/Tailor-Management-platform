import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../core/prisma';
import { config } from '../config';
import { logger } from '../core/logger';

export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  branchId?: string | null;
  name: string;
  email: string;
  role: string;
  customerId?: string;
}

declare global {
  namespace Express {
    interface Request {
      tenant?: any;
      tenantId?: string;
      user?: AuthenticatedUser;
    }
  }
}

export async function tenantContext(req: Request, res: Response, next: NextFunction) {
  try {
    let tenant = null;

    // 0. SaaS Owners have global platform access across all tenants
    if (req.user?.role === 'SAAS_OWNER') {
      return next();
    }

    // 1. If user is already authenticated (req.user set by authGuard), resolve tenant from authenticated user
    if (req.user?.tenantId) {
      try {
        tenant = await prisma.tenant.findUnique({
          where: { id: req.user.tenantId }
        });
      } catch (dbErr) {
        logger.warn(`[tenantContext] Database error resolving tenant for authenticated user: ${dbErr}`);
        // Resilient fallback: grant access with token tenantId rather than throwing 500 and causing immediate logout
        req.tenant = { id: req.user.tenantId, name: 'Atelier', isActive: true, isDemo: false };
        req.tenantId = req.user.tenantId;
        return next();
      }

      if (!tenant) {
        return res.status(404).json({
          success: false,
          error: { message: 'Authenticated tenant not found', code: 'TENANT_NOT_FOUND' }
        });
      }
      if (!tenant.isActive) {
        return res.status(403).json({
          success: false,
          error: { message: 'Tenant subscription is inactive or suspended', code: 'TENANT_INACTIVE' }
        });
      }
      req.tenant = tenant;
      req.tenantId = tenant.id;
      return next();
    }

    // 2. Check if a Bearer token is present in Authorization header (ensures tenant comes from token even if tenantContext runs before authGuard)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, config.jwtSecret) as any;
        if (decoded?.role === 'SAAS_OWNER') {
          req.user = decoded;
          return next();
        }
        if (decoded?.tenantId) {
          tenant = await prisma.tenant.findUnique({
            where: { id: decoded.tenantId }
          });
          if (tenant) {
            if (!tenant.isActive) {
              return res.status(403).json({
                success: false,
                error: { message: 'Tenant subscription is inactive or suspended', code: 'TENANT_INACTIVE' }
              });
            }
            req.tenant = tenant;
            req.tenantId = tenant.id;
            return next();
          }
        }
      } catch {
        // If JWT token is invalid or expired, proceed to let authGuard downstream reject with proper 401
      }
    }

    // 3. For unauthenticated endpoints (e.g. login, public OTP) or public routes:
    // Priority: Explicit request body > Explicit request header > Query param > Default fallback
    const slugBody = (req.body?.tenantSlug as string)?.trim();
    const slugHeader = (req.headers['x-tenant-slug'] as string)?.trim();
    const slugQuery = (req.query.tenant as string)?.trim();
    const slug = slugBody || slugHeader || slugQuery || config.defaultTenantSlug;

    tenant = await prisma.tenant.findUnique({
      where: { slug }
    });

    if (!tenant) {
      if (req.user?.role === 'SAAS_OWNER') {
        return next();
      }
      if (req.path.includes('/login') || req.path.includes('/register') || req.path.includes('/funnel')) {
        return next();
      }
      // If default slug was requested but not found, try finding any active tenant as fallback
      if (slug === config.defaultTenantSlug || slug === 'royal-bespoke') {
        const fallbackTenant = await prisma.tenant.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' }
        });
        if (fallbackTenant) {
          req.tenant = fallbackTenant;
          req.tenantId = fallbackTenant.id;
          return next();
        }
      }
      return res.status(404).json({
        success: false,
        error: { message: `Tenant '${slug}' not found`, code: 'TENANT_NOT_FOUND' }
      });
    }

    if (!tenant.isActive) {
      if (req.path.includes('/login') || req.path.includes('/register')) {
        return next();
      }
      return res.status(403).json({
        success: false,
        error: { message: 'Tenant subscription is inactive or suspended', code: 'TENANT_INACTIVE' }
      });
    }

    req.tenant = tenant;
    req.tenantId = tenant.id;
    next();
  } catch (err: any) {
    next(err);
  }
}
