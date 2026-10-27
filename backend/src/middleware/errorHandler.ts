import { Request, Response, NextFunction } from 'express';
import { logger } from '../core/logger';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  logger.error(`${req.method} ${req.url} - Error: ${err.message}`, err.stack);

  // 1. Zod Validation Errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: err.issues
      }
    });
  }

  // 2. CORS Errors
  if (err.message && err.message.includes('not allowed by CORS')) {
    return res.status(403).json({
      success: false,
      error: {
        message: 'Request origin is not allowed by CORS configuration.',
        code: 'CORS_NOT_ALLOWED'
      }
    });
  }

  // 3. Prisma Known Request Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    let statusCode = 400;
    let userMessage = 'A database operation error occurred.';
    let errorCode = `PRISMA_${err.code}`;

    switch (err.code) {
      case 'P1001':
        statusCode = 503;
        userMessage = 'Cannot reach database server. Please verify database connection settings.';
        errorCode = 'DATABASE_UNREACHABLE';
        break;
      case 'P1017':
        statusCode = 503;
        userMessage = 'Database server closed the connection. Please try again shortly.';
        errorCode = 'DATABASE_CONNECTION_CLOSED';
        break;
      case 'P2002':
        statusCode = 409;
        const target = Array.isArray((err.meta as any)?.target)
          ? ((err.meta as any).target as string[]).join(', ')
          : 'field';
        userMessage = `A record with this ${target} already exists.`;
        errorCode = 'DUPLICATE_RECORD';
        break;
      case 'P2025':
        statusCode = 404;
        userMessage = 'The requested database record was not found.';
        errorCode = 'RECORD_NOT_FOUND';
        break;
      case 'P2021':
      case 'P2022':
        statusCode = 500;
        userMessage = 'A required database table or column is missing. Please ensure database migrations have been executed.';
        errorCode = 'DATABASE_SCHEMA_MISMATCH';
        break;
      default:
        statusCode = 500;
        userMessage = process.env.NODE_ENV === 'production'
          ? 'An unexpected database error occurred. Please try again shortly.'
          : err.message;
        break;
    }

    return res.status(statusCode).json({
      success: false,
      error: {
        message: userMessage,
        code: errorCode,
        details: process.env.NODE_ENV === 'development' ? err.meta : undefined
      }
    });
  }

  // 4. Prisma Initialization / Rust Panic Errors
  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError
  ) {
    return res.status(503).json({
      success: false,
      error: {
        message: 'Database service is currently unavailable. Please verify connection credentials and network status.',
        code: 'DATABASE_INITIALIZATION_ERROR'
      }
    });
  }

  // 5. Generic / Unhandled Application Errors
  const statusCode = err.status || err.statusCode || 500;
  const isInternalOrDatabase =
    String(err.message).includes('SQL') ||
    String(err.message).includes('prisma') ||
    String(err.message).includes('syntax error');

  const safeMessage =
    process.env.NODE_ENV === 'production' && isInternalOrDatabase
      ? 'A service error occurred. Please try again shortly or contact support.'
      : err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    error: {
      message: safeMessage,
      code: err.code || 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? err.details : undefined
    }
  });
}
