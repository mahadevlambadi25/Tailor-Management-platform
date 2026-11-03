#!/usr/bin/env node
/**
 * Safe Prisma Migration Deployment Runner
 * - Normalizes and sanitizes DATABASE_URL and DIRECT_URL
 * - Strips accidental quotes or whitespace from environment variables
 * - Ensures DIRECT_URL defaults to DATABASE_URL if omitted (prevents P1012)
 * - Converts postgres:// to postgresql:// scheme (prevents P1013)
 * - Executes lifecycle-aware pre-flight guard for target out-of-band migrations
 * - Safely executes 'npx prisma migrate deploy'
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const TARGET_MIGRATION = '20261030120000_add_customer_measurement_unique_index';
const TARGET_INDEX_NAME = 'customer_measurements_tenant_customer_garment_key';
const TARGET_TABLE_NAME = 'customer_measurements';

function sanitizeUrl(url) {
  if (!url) return '';
  let cleaned = String(url).trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  if (cleaned.startsWith('postgres://')) {
    cleaned = 'postgresql://' + cleaned.slice('postgres://'.length);
  }
  return cleaned;
}

/**
 * 10-Point Pre-Flight Catalog Guard
 * Ensures production deployment cannot silently fall back to blocking index creation.
 */
async function verifyPreFlightIndex(prismaClient, options = {}) {
  const migrationsBaseDir = options.migrationsDir || path.resolve(__dirname, '../prisma/migrations');
  const targetMigrationName = options.targetMigration || TARGET_MIGRATION;
  const targetIndexName = options.targetIndex || TARGET_INDEX_NAME;
  const targetTableName = options.targetTable || TARGET_TABLE_NAME;

  // 1. Check if the target migration directory exists in the deployment package
  const targetDir = path.join(migrationsBaseDir, targetMigrationName);
  if (!fs.existsSync(targetDir)) {
    return { bypassed: true, reason: 'MIGRATION_NOT_IN_PACKAGE' };
  }

  // 2. Check if migration has already been applied in database
  try {
    const applied = await prismaClient.$queryRaw`
      SELECT id FROM _prisma_migrations
      WHERE migration_name = ${targetMigrationName}
        AND finished_at IS NOT NULL;
    `;
    if (applied && applied.length > 0) {
      return { bypassed: true, reason: 'ALREADY_APPLIED' };
    }
  } catch (err) {
    // Table _prisma_migrations might not exist on completely clean database; proceed to check
  }

  console.log(`[deploy-migrations] Target migration '${targetMigrationName}' is pending.`);
  console.log(`[deploy-migrations] Running 10-point PostgreSQL catalog guard on '${targetIndexName}'...`);

  // 3. Execute 10-point PostgreSQL system catalog inspection
  const catalog = await prismaClient.$queryRaw`
    SELECT
        n.nspname AS schema_name,
        t.relname AS table_name,
        c.relname AS index_name,
        am.amname AS access_method,
        i.indisunique AS is_unique,
        i.indisvalid AS is_valid,
        i.indisready AS is_ready,
        i.indnatts AS total_attributes,
        i.indnkeyatts AS key_attributes,
        (i.indnatts = 3 AND i.indnkeyatts = 3) AS has_exact_three_keys_no_include,
        (i.indpred IS NULL) AS is_not_partial,
        (i.indexprs IS NULL) AS is_not_expression,
        ARRAY(
            SELECT a.attname
            FROM unnest(i.indkey[0:i.indnkeyatts-1]) WITH ORDINALITY AS k(attnum, ord)
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
            ORDER BY k.ord
        ) AS key_column_names
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_am am ON am.oid = c.relam
    WHERE n.nspname = 'public'
      AND t.relname = ${targetTableName}
      AND c.relname = ${targetIndexName};
  `;

  if (!catalog || catalog.length === 0) {
    throw new Error(
      `[deploy-migrations] PRE-FLIGHT REJECTED: Required unique index '${targetIndexName}' ` +
      `does not exist in PostgreSQL. You must create it out-of-band using CREATE UNIQUE INDEX CONCURRENTLY before deploying this release.`
    );
  }

  const idx = catalog[0];
  const expectedCols = ['tenantId', 'customerId', 'garmentTypeId'];
  const colsMatch = Array.isArray(idx.key_column_names) &&
    idx.key_column_names.length === 3 &&
    idx.key_column_names.every((col, i) => col === expectedCols[i]);

  const isHealthy = Boolean(
    idx.access_method === 'btree' &&
    idx.is_unique &&
    idx.is_valid &&
    idx.is_ready &&
    idx.has_exact_three_keys_no_include &&
    idx.is_not_partial &&
    idx.is_not_expression &&
    colsMatch
  );

  if (!isHealthy) {
    throw new Error(
      `[deploy-migrations] PRE-FLIGHT REJECTED: Index '${targetIndexName}' exists but failed 10-point catalog health check ` +
      `(access_method: ${idx.access_method}, is_valid: ${idx.is_valid}, is_unique: ${idx.is_unique}, is_ready: ${idx.is_ready}, ` +
      `has_exact_three_keys_no_include: ${idx.has_exact_three_keys_no_include}, ` +
      `columns: ${JSON.stringify(idx.key_column_names)}).`
    );
  }

  console.log(`[deploy-migrations] Pre-flight guard passed: Verified valid, unique, non-partial index on (${expectedCols.join(', ')}).`);
  return { bypassed: false, verified: true };
}

async function main() {
  // 1. Sanitize DATABASE_URL
  if (process.env.DATABASE_URL) {
    process.env.DATABASE_URL = sanitizeUrl(process.env.DATABASE_URL);
  }

  // 2. Sanitize DIRECT_URL or fallback to DATABASE_URL
  if (process.env.DIRECT_URL) {
    process.env.DIRECT_URL = sanitizeUrl(process.env.DIRECT_URL);
  } else if (process.env.DATABASE_URL) {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }

  // 3. Pre-flight Guard Check
  const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (directUrl) {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prismaClient = new PrismaClient({ datasources: { db: { url: directUrl } } });
      try {
        await verifyPreFlightIndex(prismaClient);
      } finally {
        await prismaClient.$disconnect();
      }
    } catch (guardErr) {
      console.error(guardErr.message || guardErr);
      process.exit(1);
    }
  }

  console.log('[deploy-migrations] Executing Prisma migrations via schema engine...');

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
}

if (require.main === module) {
  main();
}

module.exports = {
  sanitizeUrl,
  verifyPreFlightIndex,
  TARGET_MIGRATION,
  TARGET_INDEX_NAME,
  TARGET_TABLE_NAME
};
