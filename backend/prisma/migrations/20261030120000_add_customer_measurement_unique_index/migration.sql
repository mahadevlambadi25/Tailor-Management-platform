-- CreateIndex
-- Safe, idempotent index synchronization matching schema.prisma
-- Note: In staging and production environments, this unique index is built out-of-band using CREATE UNIQUE INDEX CONCURRENTLY.
-- The IF NOT EXISTS clause ensures instant, zero-lock deployment when the index is already present,
-- while providing self-contained, deterministic execution on empty shadow databases during Prisma development flows.
CREATE UNIQUE INDEX IF NOT EXISTS "customer_measurements_tenant_customer_garment_key"
ON "customer_measurements"("tenantId", "customerId", "garmentTypeId");
