import { Request, Response, NextFunction } from 'express';
import { ROLE_PERMISSIONS } from '../config';
import { RoleType } from '@prisma/client';

export function requireRoles(...allowedRoles: RoleType[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Unauthorized.', code: 'UNAUTHORIZED' }
      });
    }

    const userRole = req.user.role as RoleType;
    if (userRole === RoleType.SAAS_OWNER || allowedRoles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: {
        message: `Forbidden: Role '${userRole}' lacks sufficient privileges.`,
        code: 'FORBIDDEN_ROLE'
      }
    });
  };
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Unauthorized.', code: 'UNAUTHORIZED' }
      });
    }

    const userRole = req.user.role;
    const perms = ROLE_PERMISSIONS[userRole] || [];

    const hasWildcard = perms.includes('*');
    const hasDomainWildcard = perms.includes(`${permission.split(':')[0]}:*`);
    const hasExact = perms.includes(permission);

    if (hasWildcard || hasDomainWildcard || hasExact) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: {
        message: `Forbidden: Permission '${permission}' required.`,
        code: 'FORBIDDEN_PERMISSION'
      }
    });
  };
}
