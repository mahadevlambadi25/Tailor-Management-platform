import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

function sanitizeDatabaseUrl(url?: string): string {
  if (!url) return '';
  let cleaned = url.trim();
  // Strip accidental outer quotes if entered in Render dashboard
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
  // Supabase PgBouncer (Port 6543) or connection poolers require pgbouncer=true so Prisma avoids prepared statements
  if ((cleaned.includes(':6543') || cleaned.includes('pooler.supabase.com')) && !cleaned.includes('pgbouncer=true')) {
    cleaned += (cleaned.includes('?') ? '&' : '?') + 'pgbouncer=true';
  }
  return cleaned;
}

// Sanitize database URLs in environment
process.env.DATABASE_URL = sanitizeDatabaseUrl(process.env.DATABASE_URL);
process.env.DIRECT_URL = sanitizeDatabaseUrl(process.env.DIRECT_URL) || process.env.DATABASE_URL;

const isProduction = (process.env.NODE_ENV || 'development') === 'production';

// Values that must never be accepted as real production secrets
const PLACEHOLDER_SECRET_PATTERN = /change_?me|placeholder|supersecret|generate_a_s|your[-_]?secret|^x+$/i;
const MIN_PRODUCTION_SECRET_LENGTH = 32;

/**
 * Signing secrets (JWT). Production: must be set, >= 32 chars, and not a known placeholder,
 * otherwise startup fails. Non-production: an unset value gets a random per-process secret
 * (tokens do not survive a restart) instead of a hardcoded, publicly known string.
 */
function requireSigningSecret(name: string): string {
  const value = (process.env[name] || '').trim();
  if (isProduction) {
    if (value.length < MIN_PRODUCTION_SECRET_LENGTH || PLACEHOLDER_SECRET_PATTERN.test(value)) {
      throw new Error(
        `FATAL: ${name} must be set to a random value of at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production (missing, too short, or a placeholder).`
      );
    }
    return value;
  }
  if (value) return value;
  // eslint-disable-next-line no-console
  console.warn(`[config] ${name} is not set; using a random ephemeral secret for this ${process.env.NODE_ENV || 'development'} process.`);
  return crypto.randomBytes(48).toString('hex');
}

/**
 * Optional third-party secrets (Razorpay, WhatsApp). Production never falls back to a placeholder:
 * an unset value stays empty and the signature checks that use it fail closed.
 */
function optionalSecret(name: string, devFallback: string): string {
  const value = (process.env[name] || '').trim();
  if (value) return value;
  return isProduction ? '' : devFallback;
}

/**
 * Express "trust proxy" setting. Number = count of trusted proxy hops in front of the app
 * (CloudFront -> ALB = 2, ALB only = 1). Unset/false keeps Express' default of trusting none.
 */
function parseTrustProxy(raw?: string): boolean | number | string {
  const value = (raw || '').trim();
  if (!value || value === 'false') return false;
  if (value === 'true') return true;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  return value; // e.g. "loopback" or a comma-separated CIDR list
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  databaseUrl: process.env.DATABASE_URL || '',
  directUrl: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  jwtSecret: requireSigningSecret('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  jwtRefreshSecret: requireSigningSecret('JWT_REFRESH_SECRET'),
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173'),
  storageProvider: process.env.STORAGE_PROVIDER || 'local',
  storageLocalDir: process.env.STORAGE_LOCAL_DIR || './uploads',
  defaultTenantSlug: process.env.DEFAULT_TENANT_SLUG || 'royal-bespoke',
  otpExpiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10),
  otpMaxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10),
  trialDurationDays: parseInt(process.env.TRIAL_DURATION_DAYS || '14', 10),
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: optionalSecret('RAZORPAY_KEY_SECRET', 'placeholder_secret'),
  razorpayWebhookSecret: optionalSecret('RAZORPAY_WEBHOOK_SECRET', '') || optionalSecret('RAZORPAY_KEY_SECRET', 'placeholder_secret'),
  whatsappVerifyToken: optionalSecret('WHATSAPP_VERIFY_TOKEN', 'tailor_whatsapp_verify_token_default'),
  whatsappAppSecret: optionalSecret('WHATSAPP_APP_SECRET', 'tailor_whatsapp_app_secret_placeholder'),
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/v1/auth/google/callback',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  conversionV1: process.env.CONVERSION_V1 !== undefined
    ? process.env.CONVERSION_V1 === 'true'
    : true,
  whatsappNumber: process.env.WHATSAPP_NUMBER || '919999999999',
  demoVideoUrlEn: process.env.DEMO_VIDEO_URL_EN || '',
  demoVideoUrlHi: process.env.DEMO_VIDEO_URL_HI || '',
  demoVideoUrlKn: process.env.DEMO_VIDEO_URL_KN || ''
};

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SAAS_OWNER: ['*'],
  SAAS_SUPPORT: ['tenants:view', 'users:view', 'audit:view', 'reports:view'],
  SHOP_OWNER: [
    'tenants:*', 'branches:*', 'users:*', 'customers:*', 'garments:*',
    'measurements:*', 'styles:*', 'orders:*', 'payments:*', 'production:*',
    'trials:*', 'alterations:*', 'appointments:*', 'notifications:*',
    'reports:*', 'documents:*', 'audit:*', 'settings:*', 'export:*'
  ],
  MANAGER: [
    'branches:view', 'users:view', 'customers:*', 'garments:*',
    'measurements:*', 'styles:*', 'orders:*', 'payments:view', 'payments:create',
    'production:*', 'trials:*', 'alterations:*', 'appointments:*',
    'notifications:*', 'reports:view', 'documents:*', 'export:view'
  ],
  RECEPTIONIST: [
    'customers:*', 'orders:create', 'orders:view', 'orders:edit',
    'measurements:create', 'measurements:view', 'styles:view',
    'payments:create', 'payments:view', 'appointments:*',
    'notifications:*', 'documents:view', 'reports:view'
  ],
  TAILOR: [
    'orders:view', 'measurements:view', 'styles:view',
    'production:view', 'production:update_stage', 'trials:view',
    'alterations:view', 'alterations:update'
  ],
  CUTTER: [
    'orders:view', 'measurements:view', 'styles:view',
    'production:view', 'production:update_stage'
  ],
  FINISHER: [
    'orders:view', 'production:view', 'production:update_stage'
  ],
  CASHIER: [
    'customers:view', 'orders:view', 'payments:*', 'reports:view'
  ],
  CUSTOMER: [
    'portal:view'
  ]
};
