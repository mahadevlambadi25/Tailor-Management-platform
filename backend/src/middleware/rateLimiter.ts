import { Request, Response, NextFunction } from 'express';

interface RateRecord {
  count: number;
  resetTime: number;
}

const rateStore = new Map<string, RateRecord>();

// Periodic memory sweep to prevent unbounded memory growth in high-traffic deployments
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateStore.entries()) {
    if (now > record.resetTime) {
      rateStore.delete(key);
    }
  }
}, 300000);
if (cleanupInterval.unref) cleanupInterval.unref();

export function rateLimiter(windowMs: number = 60000, maxRequests: number = 10) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip}_${req.baseUrl}${req.path}`;
    const now = Date.now();

    // In-flight capacity guard
    if (rateStore.size > 5000) {
      for (const [k, r] of rateStore.entries()) {
        if (now > r.resetTime) rateStore.delete(k);
      }
    }

    const record = rateStore.get(key);

    if (!record || now > record.resetTime) {
      rateStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: {
          message: 'Too many requests. Please wait and try again.',
          code: 'RATE_LIMIT_EXCEEDED'
        }
      });
    }

    record.count++;
    next();
  };
}
