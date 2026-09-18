import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/prisma';
import { OrderStatus, ProductionStageName } from '@prisma/client';

export class ReportsController {
  // Owner Dashboard Overview
  static async getOwnerDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const [
        totalOrders,
        todayOrdersCount,
        pendingOrdersCount,
        dueTodayCount,
        readyForPickupCount,
        overdueCount,
        financialAggregate
      ] = await Promise.all([
        prisma.order.count({ where: { tenantId } }),
        prisma.order.count({ where: { tenantId, createdAt: { gte: todayStart, lte: todayEnd } } }),
        prisma.order.count({ where: { tenantId, status: { in: [OrderStatus.RECEIVED, OrderStatus.IN_PROGRESS, OrderStatus.TRIAL_PENDING, OrderStatus.ALTERATION_PENDING] } } }),
        prisma.order.count({ where: { tenantId, deliveryDate: { gte: todayStart, lte: todayEnd }, status: { not: OrderStatus.DELIVERED } } }),
        prisma.order.count({ where: { tenantId, status: OrderStatus.READY_FOR_PICKUP } }),
        prisma.order.count({ where: { tenantId, deliveryDate: { lt: todayStart }, status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] } } }),
        prisma.order.aggregate({
          where: { tenantId, isCancelled: false },
          _sum: { paidAmount: true, balanceAmount: true }
        })
      ]);

      const totalRevenue = Number(financialAggregate._sum.paidAmount || 0);
      const outstandingReceivables = Number(financialAggregate._sum.balanceAmount || 0);

      return res.json({
        success: true,
        data: {
          totalOrders,
          todayOrdersCount,
          pendingOrdersCount,
          dueTodayCount,
          readyForPickupCount,
          overdueCount,
          totalRevenue,
          outstandingReceivables
        }
      });
    } catch (err) { next(err); }
  }

  // Manager Dashboard Overview
  static async getManagerDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;

      // Workload by production stage
      const stageWorkload = await prisma.productionJob.groupBy({
        by: ['currentStage'],
        where: { tenantId },
        _count: { id: true }
      });

      const delayedJobs = await prisma.productionJob.count({
        where: { tenantId, isDelayed: true }
      });

      const pendingTrials = await prisma.trial.count({
        where: { tenantId, status: 'SCHEDULED' }
      });

      return res.json({
        success: true,
        data: {
          stageWorkload,
          delayedJobs,
          pendingTrials
        }
      });
    } catch (err) { next(err); }
  }

  // Tailor Dashboard
  static async getTailorDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const staffId = req.user?.id;

      const [assignedJobs, completedToday, overdue] = await Promise.all([
        prisma.productionJob.findMany({
          where: { tenantId, assignedToId: staffId, currentStage: { not: ProductionStageName.DELIVERED } },
          include: {
            orderItem: {
              include: {
                garmentType: true,
                order: { select: { orderNumber: true, deliveryDate: true, customer: { select: { firstName: true, lastName: true } } } },
                measurementSnapshot: true
              }
            }
          }
        }),
        prisma.productionJob.count({
          where: {
            tenantId,
            assignedToId: staffId,
            completedDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
          }
        }),
        prisma.productionJob.count({
          where: {
            tenantId,
            assignedToId: staffId,
            orderItem: { order: { deliveryDate: { lt: new Date() }, status: { not: OrderStatus.DELIVERED } } }
          }
        })
      ]);

      return res.json({
        success: true,
        data: {
          assignedJobs,
          completedToday,
          overdue
        }
      });
    } catch (err) { next(err); }
  }

  // Detailed Analytical Reports
  static async getAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;

      const [ordersByGarment, paymentsByMethod, customerStats] = await Promise.all([
        prisma.orderItem.groupBy({
          by: ['garmentTypeId'],
          where: { tenantId },
          _sum: { totalItemPrice: true, quantity: true }
        }),
        prisma.payment.groupBy({
          by: ['paymentMethod'],
          where: { tenantId },
          _sum: { amount: true },
          _count: { id: true }
        }),
        prisma.customer.count({ where: { tenantId, isDeleted: false } })
      ]);

      // Enrich garment names
      const garments = await prisma.garmentType.findMany({
        where: { tenantId },
        select: { id: true, name: true }
      });
      const garmentMap = new Map(garments.map(g => [g.id, g.name]));

      const enrichedGarments = ordersByGarment.map(g => ({
        garmentName: garmentMap.get(g.garmentTypeId) || 'Unknown',
        totalRevenue: g._sum.totalItemPrice || 0,
        unitsSold: g._sum.quantity || 0
      }));

      return res.json({
        success: true,
        data: {
          customerStats: { totalCustomers: customerStats },
          ordersByGarment: enrichedGarments,
          paymentsByMethod
        }
      });
    } catch (err) { next(err); }
  }
}
