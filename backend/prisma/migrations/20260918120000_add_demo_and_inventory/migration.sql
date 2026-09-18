-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "unit" TEXT NOT NULL DEFAULT 'METERS',
    "unitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "reorderLevel" DECIMAL(10,2) NOT NULL DEFAULT 10.0,
    "supplier" TEXT,
    "notes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_tenantId_itemCode_key" ON "inventory_items"("tenantId", "itemCode");

-- CreateIndex
CREATE INDEX "inventory_items_tenantId_isDemo_idx" ON "inventory_items"("tenantId", "isDemo");

-- CreateIndex
CREATE INDEX "inventory_items_tenantId_category_idx" ON "inventory_items"("tenantId", "category");

-- CreateIndex
CREATE INDEX "tenants_isDemo_idx" ON "tenants"("isDemo");

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
