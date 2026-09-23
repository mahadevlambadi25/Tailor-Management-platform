-- 1. Create SubscriptionStatus Enum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'PAST_DUE');

-- 2. Alter status column with explicit cast
ALTER TABLE "subscriptions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "subscriptions" ALTER COLUMN "status" TYPE "SubscriptionStatus" USING (
  CASE
    WHEN "status" = 'ACTIVE' THEN 'ACTIVE'::"SubscriptionStatus"
    WHEN "status" = 'TRIAL' THEN 'TRIAL'::"SubscriptionStatus"
    WHEN "status" = 'PENDING' THEN 'PENDING'::"SubscriptionStatus"
    WHEN "status" = 'CANCELLED' THEN 'CANCELLED'::"SubscriptionStatus"
    WHEN "status" = 'EXPIRED' THEN 'EXPIRED'::"SubscriptionStatus"
    WHEN "status" = 'PAST_DUE' THEN 'PAST_DUE'::"SubscriptionStatus"
    ELSE 'TRIAL'::"SubscriptionStatus"
  END
);
ALTER TABLE "subscriptions" ALTER COLUMN "status" SET DEFAULT 'TRIAL'::"SubscriptionStatus";

-- 3. Update planName default
ALTER TABLE "subscriptions" ALTER COLUMN "planName" SET DEFAULT 'FREE_TRIAL';

-- 4. Add trial and period columns
ALTER TABLE "subscriptions" ADD COLUMN "trialStart" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN "trialEnd" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN "currentPeriodStart" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN "currentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

-- 5. Add documented future payment placeholders
ALTER TABLE "subscriptions" ADD COLUMN "paymentProvider" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "providerSubscriptionId" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "providerCustomerId" TEXT;

-- 6. Create index on status
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- 7. Backfill missing tenant subscriptions with a 14-day TRIAL subscription
INSERT INTO "subscriptions" ("id", "tenantId", "planName", "status", "trialStart", "trialEnd", "startDate", "endDate", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  t."id",
  'FREE_TRIAL',
  'TRIAL'::"SubscriptionStatus",
  NOW(),
  NOW() + INTERVAL '14 days',
  NOW(),
  NOW() + INTERVAL '14 days',
  NOW(),
  NOW()
FROM "tenants" t
LEFT JOIN "subscriptions" s ON s."tenantId" = t."id"
WHERE s."id" IS NULL;

-- 8. Populate trialStart and trialEnd for existing TRIAL subscriptions if null
UPDATE "subscriptions"
SET
  "trialStart" = COALESCE("trialStart", "startDate", NOW()),
  "trialEnd" = COALESCE("trialEnd", "endDate", NOW() + INTERVAL '14 days')
WHERE "status" = 'TRIAL'::"SubscriptionStatus" AND "trialEnd" IS NULL;
