-- Add trialUsed column with default false
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "trialUsed" BOOLEAN NOT NULL DEFAULT false;

-- Create index on trialUsed
CREATE INDEX IF NOT EXISTS "subscriptions_trialUsed_idx" ON "subscriptions"("trialUsed");

-- Backfill existing subscriptions that have consumed or are currently in trial / active / expired
UPDATE "subscriptions"
SET "trialUsed" = true
WHERE "status" IN ('TRIAL', 'EXPIRED', 'ACTIVE', 'CANCELLED', 'PAST_DUE')
   OR "trialStart" IS NOT NULL;
