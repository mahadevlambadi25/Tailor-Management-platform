-- ============================================================================
-- Migration: 20261102170000_enhance_outbox_nudgelog_reliability
-- Description: Non-destructive evolution of outbox_messages, nudge_logs, and webhook_events.
-- Naming: 100% matched to Prisma 5.22.0 schema map identifiers.
-- Safety: Additive only. Preserves existing STUBBED and SENT records.
-- ============================================================================

-- 1. Evolve outbox_messages
ALTER TABLE "outbox_messages"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "maxRetries" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "nextRetryAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lockedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "leaseToken" TEXT,
  ADD COLUMN IF NOT EXISTS "providerMessageId" TEXT,
  ADD COLUMN IF NOT EXISTS "lastError" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "nudgeLogId" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "outbox_messages" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Standard Unique Indexes (No partial predicates; enables multi-nulls, zero Prisma drift)
CREATE UNIQUE INDEX IF NOT EXISTS "outbox_messages_idempotencyKey_key"
  ON "outbox_messages"("idempotencyKey");

CREATE UNIQUE INDEX IF NOT EXISTS "outbox_messages_providerMessageId_key"
  ON "outbox_messages"("providerMessageId");

CREATE INDEX IF NOT EXISTS "outbox_messages_status_nextRetryAt_idx"
  ON "outbox_messages"("status", "nextRetryAt");

CREATE INDEX IF NOT EXISTS "outbox_messages_lockedAt_idx"
  ON "outbox_messages"("lockedAt");

CREATE INDEX IF NOT EXISTS "outbox_messages_leaseToken_idx"
  ON "outbox_messages"("leaseToken");

CREATE INDEX IF NOT EXISTS "outbox_messages_nudgeLogId_idx"
  ON "outbox_messages"("nudgeLogId");

-- 2. Evolve nudge_logs
ALTER TABLE "nudge_logs"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "error" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "nudge_logs" ALTER COLUMN "status" SET DEFAULT 'QUEUED';

CREATE UNIQUE INDEX IF NOT EXISTS "nudge_logs_idempotencyKey_key"
  ON "nudge_logs"("idempotencyKey");

CREATE INDEX IF NOT EXISTS "nudge_logs_sentAt_idx"
  ON "nudge_logs"("sentAt");

-- Scoped Foreign Key Constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = CURRENT_SCHEMA()
      AND tc.table_name = 'outbox_messages'
      AND tc.constraint_name = 'outbox_messages_nudgeLogId_fkey'
  ) THEN
    ALTER TABLE "outbox_messages"
      ADD CONSTRAINT "outbox_messages_nudgeLogId_fkey"
      FOREIGN KEY ("nudgeLogId") REFERENCES "nudge_logs"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Create webhook_events Table
CREATE TABLE IF NOT EXISTS "webhook_events" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROCESSED',
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "webhook_events_provider_eventId_key"
  ON "webhook_events"("provider", "eventId");

CREATE INDEX IF NOT EXISTS "webhook_events_provider_eventType_idx"
  ON "webhook_events"("provider", "eventType");
