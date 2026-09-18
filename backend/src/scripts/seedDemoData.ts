import { prisma } from '../core/prisma';
import { logger } from '../core/logger';
import { seedIdentifiableDemoTenant, seedDemoDataForTenant } from '../modules/demo/demoService';
import process from 'process';

async function main() {
  console.log('================================================================');
  console.log('       TAILOR MANAGEMENT SYSTEM — SAFE DEMO DATA SEED           ');
  console.log('================================================================\n');

  try {
    const args = process.argv.slice(2);
    const tenantSlugIndex = args.indexOf('--tenant');
    const targetSlug = tenantSlugIndex !== -1 && args[tenantSlugIndex + 1] ? args[tenantSlugIndex + 1] : null;

    if (targetSlug) {
      console.log(`Target tenant slug specified: "${targetSlug}"`);
      const tenant = await prisma.tenant.findUnique({ where: { slug: targetSlug } });
      if (!tenant) {
        console.error(`ERROR: Tenant with slug "${targetSlug}" not found in database.`);
        process.exit(1);
      }

      console.log(`Found tenant "${tenant.name}" (${tenant.id}). Seeding complete demo data...`);
      const stats = await seedDemoDataForTenant(tenant.id);

      console.log('\n✔ Demo data successfully created for tenant:');
      console.log(`  - Tenant Name:       ${tenant.name}`);
      console.log(`  - Tenant Slug:       ${tenant.slug}`);
      console.log(`  - Demo Orders:       ${stats.demoOrdersCount}`);
      console.log(`  - Demo Customers:    ${stats.demoCustomersCount}`);
      console.log(`  - Demo Appointments: ${stats.demoAppointmentsCount}`);
      console.log(`  - Demo Inventory:    ${stats.demoInventoryCount}`);
    } else {
      console.log('Seeding dedicated identifiable demo tenant ("demo-tailors")...');
      const { tenant, stats } = await seedIdentifiableDemoTenant('demo-tailors');

      console.log('\n✔ Dedicated demo tenant successfully created and seeded:');
      console.log(`  - Demo Tenant Name:  ${tenant.name}`);
      console.log(`  - Demo Tenant Slug:  ${tenant.slug}`);
      console.log(`  - Demo Flag (DB):    ${tenant.isDemo ? 'isDemo === true' : 'false'}`);
      console.log(`  - Demo Orders:       ${stats.demoOrdersCount}`);
      console.log(`  - Demo Customers:    ${stats.demoCustomersCount}`);
      console.log(`  - Demo Appointments: ${stats.demoAppointmentsCount}`);
      console.log(`  - Demo Inventory:    ${stats.demoInventoryCount}`);
      console.log(`  - Staff Roles:       Owner, Manager, Receptionist, Tailor, Cutter, Finisher, Cashier`);
      console.log('  - Default Passwords: Password@123');
    }

    console.log('\n================================================================');
    console.log('  SAFE DEMO DATA CREATION COMPLETE — ZERO REAL DATA TOUCHED     ');
    console.log('================================================================\n');
  } catch (error: any) {
    logger.error('Failed to seed demo data:', error);
    console.error('FATAL: Demo data seed encountered an error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
