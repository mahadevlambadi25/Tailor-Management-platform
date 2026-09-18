import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export function authGuard(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { message: 'Authentication required. Missing or malformed Bearer token.', code: 'UNAUTHORIZED' }
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    
    // Enforce authenticated tenant context from verified JWT token
    if (decoded.tenantId && decoded.role !== 'SAAS_OWNER') {
      req.tenantId = decoded.tenantId;
    }

    req.user = decoded;
    next();
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired token.', code: 'TOKEN_INVALID' }
    });
  }
}
