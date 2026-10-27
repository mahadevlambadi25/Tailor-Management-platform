-- ============================================================================
-- Migration: 20260927000000_sync_schema_tables_and_columns
-- Description: Adds missing sample flags, tenant onboarding fields, billing 
--              lifecycle tables (payments & invoices), and conversion tables.
-- ============================================================================

-- 1. Create Enums if they do not exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionPaymentStatus') THEN
        CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionInvoiceStatus') THEN
        CREATE TYPE "SubscriptionInvoiceStatus" AS ENUM ('ISSUED', 'PAID', 'VOID');
    END IF;
END $$;

-- 2. Alter "tenants" table: Add onboarding & shop profile columns
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "shopType" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "teamSize" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "shopCount" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "checklistDismissed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "tourCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "samplePromptDismissed" BOOLEAN NOT NULL DEFAULT false;

-- 3. Alter "users" table: Add isSample column and index
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isSample" BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS "users_tenantId_isSample_idx" ON "users"("tenantId", "isSample");

-- 4. Alter "customers" table: Add isSample column and index
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "isSample" BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS "customers_tenantId_isSample_idx" ON "customers"("tenantId", "isSample");

-- 5. Alter "orders" table: Add isSample column and index
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "isSample" BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS "orders_tenantId_isSample_idx" ON "orders"("tenantId", "isSample");

-- 6. Alter "appointments" table: Add isSample column and index
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "isSample" BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS "appointments_tenantId_isSample_idx" ON "appointments"("tenantId", "isSample");

-- 7. Create "subscription_payments" table
CREATE TABLE IF NOT EXISTS "subscription_payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'razorpay',
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT,
    "signature" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "planName" TEXT NOT NULL,
    "billingPeriod" TEXT DEFAULT 'MONTHLY',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "subscription_payments_tenantId_idx" ON "subscription_payments"("tenantId");
CREATE INDEX IF NOT EXISTS "subscription_payments_subscriptionId_idx" ON "subscription_payments"("subscriptionId");
CREATE INDEX IF NOT EXISTS "subscription_payments_orderId_idx" ON "subscription_payments"("orderId");
CREATE INDEX IF NOT EXISTS "subscription_payments_paymentId_idx" ON "subscription_payments"("paymentId");
CREATE INDEX IF NOT EXISTS "subscription_payments_status_idx" ON "subscription_payments"("status");

-- 8. Create "subscription_invoices" table
CREATE TABLE IF NOT EXISTS "subscription_invoices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "paymentId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "SubscriptionInvoiceStatus" NOT NULL DEFAULT 'PAID',
    "billingPeriodStart" TIMESTAMP(3) NOT NULL,
    "billingPeriodEnd" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "providerPaymentId" TEXT,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "billingAddress" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_invoices_paymentId_key" ON "subscription_invoices"("paymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_invoices_tenantId_invoiceNumber_key" ON "subscription_invoices"("tenantId", "invoiceNumber");
CREATE INDEX IF NOT EXISTS "subscription_invoices_tenantId_idx" ON "subscription_invoices"("tenantId");
CREATE INDEX IF NOT EXISTS "subscription_invoices_subscriptionId_idx" ON "subscription_invoices"("subscriptionId");
CREATE INDEX IF NOT EXISTS "subscription_invoices_status_idx" ON "subscription_invoices"("status");

-- 9. Foreign Keys for subscription_payments and subscription_invoices
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_payments_tenantId_fkey') THEN
        ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_payments_subscriptionId_fkey') THEN
        ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_invoices_tenantId_fkey') THEN
        ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_invoices_subscriptionId_fkey') THEN
        ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_invoices_paymentId_fkey') THEN
        ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "subscription_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- 10. Create "funnel_events" table
CREATE TABLE IF NOT EXISTS "funnel_events" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "userId" TEXT,
    "event" TEXT NOT NULL,
    "props" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funnel_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "funnel_events_shopId_idx" ON "funnel_events"("shopId");
CREATE INDEX IF NOT EXISTS "funnel_events_event_idx" ON "funnel_events"("event");
CREATE INDEX IF NOT EXISTS "funnel_events_createdAt_idx" ON "funnel_events"("createdAt");

-- 11. Create "outbox_messages" table
CREATE TABLE IF NOT EXISTS "outbox_messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'WHATSAPP',
    "to" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "vars" JSONB,
    "renderedContent" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'STUBBED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "outbox_messages_tenantId_idx" ON "outbox_messages"("tenantId");
CREATE INDEX IF NOT EXISTS "outbox_messages_channel_idx" ON "outbox_messages"("channel");

-- 12. Create "nudge_logs" table
CREATE TABLE IF NOT EXISTS "nudge_logs" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'SENT',

    CONSTRAINT "nudge_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "nudge_logs_shopId_key_key" ON "nudge_logs"("shopId", "key");
CREATE INDEX IF NOT EXISTS "nudge_logs_shopId_idx" ON "nudge_logs"("shopId");
