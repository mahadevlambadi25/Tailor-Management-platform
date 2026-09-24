import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'supersecret_tailor_access_key_2026_jwt',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'supersecret_tailor_refresh_key_2026_jwt',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  storageProvider: process.env.STORAGE_PROVIDER || 'local',
  storageLocalDir: process.env.STORAGE_LOCAL_DIR || './uploads',
  defaultTenantSlug: process.env.DEFAULT_TENANT_SLUG || 'royal-bespoke',
  otpExpiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10),
  otpMaxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10),
  trialDurationDays: parseInt(process.env.TRIAL_DURATION_DAYS || '14', 10),
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret'
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
