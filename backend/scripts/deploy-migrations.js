#!/usr/bin/env node
/**
 * Safe Prisma Migration Deployment Runner
 * - Normalizes and sanitizes DATABASE_URL and DIRECT_URL
 * - Strips accidental quotes or whitespace from environment variables
 * - Ensures DIRECT_URL defaults to DATABASE_URL if omitted (prevents P1012)
 * - Converts postgres:// to postgresql:// scheme (prevents P1013)
 * - Safely executes 'npx prisma migrate deploy'
 */

const { execSync } = require('child_process');
const path = require('path');

function sanitizeUrl(url) {
  if (!url) return '';
  let cleaned = String(url).trim();
  // Strip enclosing quotes if entered into web dashboards (e.g. "postgresql://..." or 'postgresql://...')
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  // Normalize postgres:// to postgresql://
  if (cleaned.startsWith('postgres://')) {
    cleaned = 'postgresql://' + cleaned.slice('postgres://'.length);
  }
  return cleaned;
}

// 1. Sanitize DATABASE_URL
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = sanitizeUrl(process.env.DATABASE_URL);
}

// 2. Sanitize DIRECT_URL or fallback to DATABASE_URL
if (process.env.DIRECT_URL) {
  process.env.DIRECT_URL = sanitizeUrl(process.env.DIRECT_URL);
} else if (process.env.DATABASE_URL) {
  // If DIRECT_URL is missing, default to DATABASE_URL so Prisma P1012 does not halt deployment
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

console.log('[deploy-migrations] Validating database configuration and executing Prisma migrations...');

try {
  const backendDir = path.resolve(__dirname, '..');
  execSync('npx prisma migrate deploy', {
    cwd: backendDir,
    stdio: 'inherit',
    env: process.env
  });
  console.log('[deploy-migrations] Database migrations applied successfully.');
} catch (err) {
  console.error('[deploy-migrations] FATAL: Prisma migrate deploy failed.');
  process.exit(1);
}
