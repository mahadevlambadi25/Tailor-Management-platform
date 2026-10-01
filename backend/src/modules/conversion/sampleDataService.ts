import { prisma } from '../../core/prisma';
import { logger } from '../../core/logger';

export class SampleDataService {
  /**
   * Seeding demo/sample shop data is completely disabled in production.
   * New tenants start clean with 0 sample records.
   */
  static async seedSampleShopData(_tenantId: string): Promise<boolean> {
    logger.info(`[SampleDataService] Automatic sample shop seeding is permanently disabled.`);
    return false;
  }

  /**
   * Status check - reports 0 sample records.
   */
  static async getStatus(tenantId: string) {
    const realCustomers = await prisma.customer.count({
      where: { tenantId, isSample: { not: true }, isDemo: false, isDeleted: false }
    });
    const realOrders = await prisma.order.count({
      where: { tenantId, isSample: { not: true }, isDemo: false, isCancelled: false }
    });

    return {
      hasSampleData: false,
      sampleCustomers: 0,
      sampleOrders: 0,
      sampleStaff: 0,
      realCustomers,
      realOrders
    };
  }

  /**
   * Safe purge of legacy sample records only. Never touches real data.
   */
  static async clearSampleData(tenantId: string) {
    logger.info(`[SampleDataService] Purging legacy sample records for tenant: ${tenantId}`);

    const [deletedMeasurements, deletedOrders, deletedCustomers, deletedStaff] = await prisma.$transaction([
      prisma.customerMeasurement.deleteMany({
        where: { tenantId, customer: { isSample: true } }
      }),
      prisma.order.deleteMany({
        where: { tenantId, isSample: true }
      }),
      prisma.customer.deleteMany({
        where: { tenantId, isSample: true }
      }),
      prisma.user.deleteMany({
        where: { tenantId, isSample: true }
      })
    ]);

    return {
      deletedCustomers: deletedCustomers.count,
      deletedOrders: deletedOrders.count,
      deletedMeasurements: deletedMeasurements.count,
      deletedStaff: deletedStaff.count
    };
  }

  static async clearSampleShopData(tenantId: string) {
    return this.clearSampleData(tenantId);
  }
}
