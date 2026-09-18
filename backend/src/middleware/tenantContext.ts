import { Request, Response, NextFunction } from 'express';
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
    // Determine tenant slug from header, query, or fallback default
    const slugHeader = req.headers['x-tenant-slug'] as string;
    const slugQuery = req.query.tenant as string;
    const slug = slugHeader || slugQuery || config.defaultTenantSlug;

    const tenant = await prisma.tenant.findUnique({
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
