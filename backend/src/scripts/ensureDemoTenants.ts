import { prisma } from '../core/prisma';
import { seedDemoDataForTenant } from '../modules/demo/demoService';

async function main() {
  await prisma.tenant.updateMany({
    where: { slug: { in: ['royal-bespoke', 'demo-tailors'] } },
    data: { isDemo: true }
  });

  const royal = await prisma.tenant.findUnique({ where: { slug: 'royal-bespoke' } });
  if (royal) {
    const demoOrders = await prisma.order.count({ where: { tenantId: royal.id, isDemo: true } });
    if (demoOrders === 0) {
      console.log('Seeding demo data for royal-bespoke...');
      await seedDemoDataForTenant(royal.id);
    }
  }

  const demoTailors = await prisma.tenant.findUnique({ where: { slug: 'demo-tailors' } });
  if (demoTailors) {
    const demoOrders = await prisma.order.count({ where: { tenantId: demoTailors.id, isDemo: true } });
    if (demoOrders === 0) {
      console.log('Seeding demo data for demo-tailors...');
      await seedDemoDataForTenant(demoTailors.id);
    }
  }

  console.log('✔ Developer demo accounts verified with demo data intact');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
