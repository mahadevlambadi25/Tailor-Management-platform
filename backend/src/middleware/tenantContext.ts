import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../core/prisma';
import { config } from '../config';

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

    // 1. If user is already authenticated (req.user set by authGuard), resolve tenant from authenticated user
    if (req.user?.tenantId && req.user.role !== 'SAAS_OWNER') {
      tenant = await prisma.tenant.findUnique({
        where: { id: req.user.tenantId }
      });
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
        if (decoded?.tenantId && decoded.role !== 'SAAS_OWNER') {
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

    // 3. For unauthenticated endpoints (e.g. login, public OTP) or SAAS_OWNER:
    // Priority: Explicit request body > Explicit request header > Query param > Default fallback
    const slugBody = (req.body?.tenantSlug as string)?.trim();
    const slugHeader = (req.headers['x-tenant-slug'] as string)?.trim();
    const slugQuery = (req.query.tenant as string)?.trim();
    const slug = slugBody || slugHeader || slugQuery || config.defaultTenantSlug;

    tenant = await prisma.tenant.findUnique({
      where: { slug }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: { message: `Tenant '${slug}' not found`, code: 'TENANT_NOT_FOUND' }
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
    next();
  } catch (err: any) {
    next(err);
  }
}
