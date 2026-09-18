import { prisma } from '../core/prisma';
import { logger } from '../core/logger';
import { purgeTenantDemoData } from '../modules/demo/demoService';
import process from 'process';

async function main() {
  console.log('================================================================');
  console.log('      TAILOR MANAGEMENT SYSTEM — SAFE DEMO DATA CLEANUP         ');
  console.log('================================================================\n');

  try {
    const args = process.argv.slice(2);
    const tenantSlugIndex = args.indexOf('--tenant');
    const targetSlug = tenantSlugIndex !== -1 && args[tenantSlugIndex + 1] ? args[tenantSlugIndex + 1] : null;
    const cleanAll = args.includes('--all');

    if (targetSlug) {
      console.log(`Target tenant slug specified: "${targetSlug}"`);
      const tenant = await prisma.tenant.findUnique({ where: { slug: targetSlug } });
      if (!tenant) {
        console.error(`ERROR: Tenant with slug "${targetSlug}" not found in database.`);
        process.exit(1);
      }

      console.log(`Found tenant "${tenant.name}" (${tenant.id}).`);
      console.log('Executing transactional demo purge (isDemo: true only)...');
      const result = await purgeTenantDemoData(tenant.id);

      console.log('\n✔ Demo records safely purged:');
      console.log(`  - Tenant:              ${tenant.name} (${tenant.slug}) [PRESERVED INTACT]`);
      console.log(`  - Demo Orders Purged:       ${result.deletedOrdersCount}`);
      console.log(`  - Demo Appointments Purged: ${result.deletedAppointmentsCount}`);
      console.log(`  - Demo Inventory Purged:    ${result.deletedInventoryCount}`);
      console.log(`  - Demo Customers Purged:    ${result.deletedCustomersCount}`);
    } else {
      // Clean dedicated demo tenant ("demo-tailors") and any tenant marked isDemo: true, or prompt
      const demoTenants = await prisma.tenant.findMany({
        where: {
          OR: [
            { slug: 'demo-tailors' },
            { isDemo: true }
          ]
        }
      });

      if (demoTenants.length === 0) {
        console.log('No demo tenants found. Checking default tenant ("royal-bespoke") for demo records...');
        const defaultTenant = await prisma.tenant.findUnique({ where: { slug: 'royal-bespoke' } });
        if (defaultTenant) {
          const result = await purgeTenantDemoData(defaultTenant.id);
          console.log(`\n✔ Cleaned demo records from default tenant "${defaultTenant.name}":`);
          console.log(`  - Demo Orders Purged:       ${result.deletedOrdersCount}`);
          console.log(`  - Demo Appointments Purged: ${result.deletedAppointmentsCount}`);
          console.log(`  - Demo Inventory Purged:    ${result.deletedInventoryCount}`);
          console.log(`  - Demo Customers Purged:    ${result.deletedCustomersCount}`);
        }
      } else {
        for (const dt of demoTenants) {
          console.log(`Purging demo records for demo tenant "${dt.name}" (${dt.slug})...`);
          const result = await purgeTenantDemoData(dt.id);
          console.log(`  - Demo Orders:       ${result.deletedOrdersCount}`);
          console.log(`  - Demo Appointments: ${result.deletedAppointmentsCount}`);
          console.log(`  - Demo Inventory:    ${result.deletedInventoryCount}`);
          console.log(`  - Demo Customers:    ${result.deletedCustomersCount}`);
        }
      }
    }

    console.log('\n================================================================');
    console.log('  SAFE CLEANUP COMPLETE — ZERO REAL DATA, USERS, OR SHOPS LOST ');
    console.log('================================================================\n');
  } catch (error: any) {
    logger.error('Failed to clean demo data:', error);
    console.error('FATAL: Demo data cleanup encountered an error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
