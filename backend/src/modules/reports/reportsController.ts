import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/prisma';
import { OrderStatus, ProductionStageName, PaymentStatus, PaymentMethod, RoleType } from '@prisma/client';
import { ReportDateUtils } from './reportDateUtils';
import { PaymentCalculationService } from '../payments/paymentCalculationService';

export class ReportsController {
  // ---------------------------------------------------------------------------
  // Helper: Validate Branch for Tenant
  // ---------------------------------------------------------------------------
  private static async validateBranch(tenantId: string, branchId?: string): Promise<{ valid: boolean; error?: string }> {
    if (!branchId) return { valid: true };
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, tenantId }
    });
    if (!branch) {
      return { valid: false, error: 'Branch not found or does not belong to your shop.' };
    }
    return { valid: true };
  }

  // ---------------------------------------------------------------------------
  // 1. Overview Report (12 Dashboard KPIs)
  // ---------------------------------------------------------------------------
  static async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { range, startDate: qStart, endDate: qEnd, branchId } = req.query as {
        range?: string;
        startDate?: string;
        endDate?: string;
        branchId?: string;
      };

      // Date validation
      const dateResult = ReportDateUtils.parseDateRange({ range, startDate: qStart, endDate: qEnd });
      if (!dateResult.valid || !dateResult.data) {
        return res.status(400).json({
          success: false,
          error: { message: dateResult.error, code: dateResult.code }
        });
      }
      const { startDate, endDate, preset } = dateResult.data;

      // Branch validation
      const branchCheck = await ReportsController.validateBranch(tenantId, branchId);
      if (!branchCheck.valid) {
        return res.status(404).json({
          success: false,
          error: { message: branchCheck.error, code: 'BRANCH_NOT_FOUND' }
        });
      }

      // Today boundaries
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const branchOrderFilter = branchId ? { branchId } : {};

      // Execute aggregations in parallel
      const [
        totalCustomers,
        newCustomers,
        totalOrders,
        newOrders,
        ordersInProgress,
        ordersReadyForPickup,
        deliveredOrders,
        delayedOrders,
        pendingPaymentOrders,
        todayPayments,
        periodPayments,
        revenueAggregate,
        receivablesAggregate
      ] = await Promise.all([
        // 1. Total Customers
        prisma.customer.count({ where: { tenantId, isDeleted: false } }),
        // 2. New Customers in period
        prisma.customer.count({ where: { tenantId, isDeleted: false, createdAt: { gte: startDate, lte: endDate } } }),
        // 3. Total active orders
        prisma.order.count({ where: { tenantId, isCancelled: false, ...branchOrderFilter } }),
        // 4. New Orders in period
        prisma.order.count({ where: { tenantId, isCancelled: false, createdAt: { gte: startDate, lte: endDate }, ...branchOrderFilter } }),
        // 5. Orders In Progress
        prisma.order.count({
          where: {
            tenantId,
            isCancelled: false,
            status: { in: [OrderStatus.RECEIVED, OrderStatus.IN_PROGRESS, OrderStatus.TRIAL_PENDING, OrderStatus.ALTERATION_PENDING] },
            ...branchOrderFilter
          }
        }),
        // 6. Orders Ready for Pickup
        prisma.order.count({ where: { tenantId, isCancelled: false, status: OrderStatus.READY_FOR_PICKUP, ...branchOrderFilter } }),
        // 7. Delivered Orders in period
        prisma.order.count({
          where: {
            tenantId,
            status: OrderStatus.DELIVERED,
            updatedAt: { gte: startDate, lte: endDate },
            ...branchOrderFilter
          }
        }),
        // 8. Delayed Orders (active past delivery date)
        prisma.order.count({
          where: {
            tenantId,
            deliveryDate: { lt: new Date() },
            status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
            ...branchOrderFilter
          }
        }),
        // 9. Pending Payment Orders
        prisma.order.count({
          where: {
            tenantId,
            isCancelled: false,
            paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL] },
            ...branchOrderFilter
          }
        }),
        // 10. Today's Collections (Payments - Refunds)
        prisma.payment.findMany({
          where: {
            tenantId,
            createdAt: { gte: todayStart, lte: todayEnd },
            ...(branchId ? { order: { branchId } } : {})
          },
          select: { amount: true, isRefund: true }
        }),
        // 11. Period Collections (Payments - Refunds)
        prisma.payment.findMany({
          where: {
            tenantId,
            createdAt: { gte: startDate, lte: endDate },
            ...(branchId ? { order: { branchId } } : {})
          },
          select: { amount: true, isRefund: true }
        }),
        // 12. Period Revenue (netAmount of orders created in range)
        prisma.order.aggregate({
          where: {
            tenantId,
            isCancelled: false,
            createdAt: { gte: startDate, lte: endDate },
            ...branchOrderFilter
          },
          _sum: { netAmount: true }
        }),
        // 13. Outstanding Receivables (balanceAmount across all active orders)
        prisma.order.aggregate({
          where: {
            tenantId,
            isCancelled: false,
            ...branchOrderFilter
          },
          _sum: { balanceAmount: true }
        })
      ]);

      const todayCollection = Math.max(
        0,
        PaymentCalculationService.round2(
          todayPayments.reduce((sum, p) => p.isRefund ? sum - Number(p.amount) : sum + Number(p.amount), 0)
        )
      );

      const periodCollection = Math.max(
        0,
        PaymentCalculationService.round2(
          periodPayments.reduce((sum, p) => p.isRefund ? sum - Number(p.amount) : sum + Number(p.amount), 0)
        )
      );

      const totalRevenue = PaymentCalculationService.round2(Number(revenueAggregate._sum.netAmount || 0));
      const outstandingReceivables = PaymentCalculationService.round2(Number(receivablesAggregate._sum.balanceAmount || 0));

      return res.json({
        success: true,
        data: {
          period: {
            preset,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          },
          kpis: {
            totalCustomers,
            newCustomers,
            totalOrders,
            newOrders,
            ordersInProgress,
            ordersReadyForPickup,
            deliveredOrders,
            delayedOrders,
            pendingPaymentOrders,
            todayCollection,
            periodCollection,
            totalRevenue,
            outstandingReceivables
          }
        }
      });
    } catch (err) { next(err); }
  }

  // ---------------------------------------------------------------------------
  // 2. Order Reports
  // ---------------------------------------------------------------------------
  static async getOrderReports(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { range, startDate: qStart, endDate: qEnd, branchId } = req.query as {
        range?: string;
        startDate?: string;
        endDate?: string;
        branchId?: string;
      };

      const dateResult = ReportDateUtils.parseDateRange({ range, startDate: qStart, endDate: qEnd });
      if (!dateResult.valid || !dateResult.data) {
        return res.status(400).json({ success: false, error: { message: dateResult.error, code: dateResult.code } });
      }
      const { startDate, endDate, preset } = dateResult.data;

      const branchCheck = await ReportsController.validateBranch(tenantId, branchId);
      if (!branchCheck.valid) {
        return res.status(404).json({ success: false, error: { message: branchCheck.error, code: 'BRANCH_NOT_FOUND' } });
      }

      const branchOrderFilter = branchId ? { branchId } : {};

      const [orders, orderItems] = await Promise.all([
        prisma.order.findMany({
          where: {
            tenantId,
            createdAt: { gte: startDate, lte: endDate },
            ...branchOrderFilter
          },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            isCancelled: true,
            netAmount: true,
            deliveryDate: true,
            updatedAt: true,
            createdAt: true,
            branchId: true
          }
        }),
        prisma.orderItem.findMany({
          where: {
            tenantId,
            order: {
              createdAt: { gte: startDate, lte: endDate },
              ...branchOrderFilter
            }
          },
          select: {
            garmentTypeId: true,
            quantity: true,
            totalItemPrice: true,
            garmentType: { select: { name: true } }
          }
        })
      ]);

      // 1. Status Breakdown
      const allStatuses: OrderStatus[] = [
        OrderStatus.RECEIVED,
        OrderStatus.IN_PROGRESS,
        OrderStatus.TRIAL_PENDING,
        OrderStatus.ALTERATION_PENDING,
        OrderStatus.READY_FOR_PICKUP,
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED
      ];

      const statusMap = new Map<OrderStatus, { count: number; totalAmount: number }>();
      allStatuses.forEach(s => statusMap.set(s, { count: 0, totalAmount: 0 }));

      orders.forEach(o => {
        const item = statusMap.get(o.status) || { count: 0, totalAmount: 0 };
        item.count += 1;
        item.totalAmount = PaymentCalculationService.round2(item.totalAmount + Number(o.netAmount));
        statusMap.set(o.status, item);
      });

      const ordersByStatus = allStatuses.map(status => ({
        status,
        count: statusMap.get(status)!.count,
        totalAmount: statusMap.get(status)!.totalAmount
      }));

      // 2. Garment Breakdown
      const garmentMap = new Map<string, { garmentName: string; unitsSold: number; totalRevenue: number }>();
      orderItems.forEach(item => {
        const gId = item.garmentTypeId;
        const gName = item.garmentType?.name || 'Unknown Garment';
        const existing = garmentMap.get(gId) || { garmentName: gName, unitsSold: 0, totalRevenue: 0 };
        existing.unitsSold += item.quantity;
        existing.totalRevenue = PaymentCalculationService.round2(existing.totalRevenue + Number(item.totalItemPrice));
        garmentMap.set(gId, existing);
      });

      const totalGarmentRevenue = Array.from(garmentMap.values()).reduce((sum, g) => sum + g.totalRevenue, 0);
      const ordersByGarment = Array.from(garmentMap.entries()).map(([garmentId, data]) => ({
        garmentId,
        garmentName: data.garmentName,
        unitsSold: data.unitsSold,
        totalRevenue: data.totalRevenue,
        revenueSharePercentage: totalGarmentRevenue > 0
          ? PaymentCalculationService.round2((data.totalRevenue / totalGarmentRevenue) * 100)
          : 0
      })).sort((a, b) => b.totalRevenue - a.totalRevenue);

      // 3. Daily Timeline Trend
      const timelineMap = new Map<string, { orderCount: number; revenue: number }>();
      orders.forEach(o => {
        const dateKey = o.createdAt.toISOString().slice(0, 10);
        const entry = timelineMap.get(dateKey) || { orderCount: 0, revenue: 0 };
        entry.orderCount += 1;
        if (!o.isCancelled) {
          entry.revenue = PaymentCalculationService.round2(entry.revenue + Number(o.netAmount));
        }
        timelineMap.set(dateKey, entry);
      });

      const dailyTimeline = Array.from(timelineMap.entries())
        .map(([date, data]) => ({ date, orderCount: data.orderCount, revenue: data.revenue }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // 4. Metrics & KPIs
      const totalOrders = orders.length;
      const activeOrders = orders.filter(o => !o.isCancelled).length;
      const cancelledOrders = orders.filter(o => o.isCancelled).length;
      const totalRevenue = PaymentCalculationService.round2(
        orders.filter(o => !o.isCancelled).reduce((sum, o) => sum + Number(o.netAmount), 0)
      );
      const averageOrderValue = activeOrders > 0
        ? PaymentCalculationService.round2(totalRevenue / activeOrders)
        : 0;
      const cancellationRate = totalOrders > 0
        ? PaymentCalculationService.round2((cancelledOrders / totalOrders) * 100)
        : 0;

      const deliveredOrders = orders.filter(o => o.status === OrderStatus.DELIVERED);
      const onTimeDeliveredCount = deliveredOrders.filter(o => o.updatedAt <= o.deliveryDate).length;
      const onTimeDeliveryRate = deliveredOrders.length > 0
        ? PaymentCalculationService.round2((onTimeDeliveredCount / deliveredOrders.length) * 100)
        : 100;

      return res.json({
        success: true,
        data: {
          period: { preset, startDate: startDate.toISOString(), endDate: endDate.toISOString() },
          summary: {
            totalOrders,
            activeOrders,
            cancelledOrders,
            totalRevenue,
            averageOrderValue,
            cancellationRate,
            deliveredCount: deliveredOrders.length,
            onTimeDeliveredCount,
            onTimeDeliveryRate
          },
          ordersByStatus,
          ordersByGarment,
          dailyTimeline
        }
      });
    } catch (err) { next(err); }
  }

  // ---------------------------------------------------------------------------
  // 3. Payment Reports
  // ---------------------------------------------------------------------------
  static async getPaymentReports(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { range, startDate: qStart, endDate: qEnd, branchId } = req.query as {
        range?: string;
        startDate?: string;
        endDate?: string;
        branchId?: string;
      };

      const dateResult = ReportDateUtils.parseDateRange({ range, startDate: qStart, endDate: qEnd });
      if (!dateResult.valid || !dateResult.data) {
        return res.status(400).json({ success: false, error: { message: dateResult.error, code: dateResult.code } });
      }
      const { startDate, endDate, preset } = dateResult.data;

      const branchCheck = await ReportsController.validateBranch(tenantId, branchId);
      if (!branchCheck.valid) {
        return res.status(404).json({ success: false, error: { message: branchCheck.error, code: 'BRANCH_NOT_FOUND' } });
      }

      const branchPaymentFilter = branchId ? { order: { branchId } } : {};
      const branchOrderFilter = branchId ? { branchId } : {};

      const [payments, orderPaymentCounts, receivablesAggregate, overdueAggregate] = await Promise.all([
        // Payments in date range
        prisma.payment.findMany({
          where: {
            tenantId,
            createdAt: { gte: startDate, lte: endDate },
            ...branchPaymentFilter
          },
          select: {
            id: true,
            amount: true,
            paymentMethod: true,
            isRefund: true,
            createdAt: true
          }
        }),
        // Payment status counts for orders in date range
        prisma.order.groupBy({
          by: ['paymentStatus'],
          where: {
            tenantId,
            isCancelled: false,
            createdAt: { gte: startDate, lte: endDate },
            ...branchOrderFilter
          },
          _count: { id: true },
          _sum: { paidAmount: true, balanceAmount: true, netAmount: true }
        }),
        // All-time outstanding receivables
        prisma.order.aggregate({
          where: {
            tenantId,
            isCancelled: false,
            ...branchOrderFilter
          },
          _sum: { balanceAmount: true }
        }),
        // Overdue receivables (orders past delivery date with positive balance)
        prisma.order.aggregate({
          where: {
            tenantId,
            isCancelled: false,
            deliveryDate: { lt: new Date() },
            status: { not: OrderStatus.DELIVERED },
            balanceAmount: { gt: 0 },
            ...branchOrderFilter
          },
          _sum: { balanceAmount: true }
        })
      ]);

      // 1. Collections Summary
      let grossCollections = 0;
      let totalRefunds = 0;
      payments.forEach(p => {
        const amt = Number(p.amount);
        if (p.isRefund) {
          totalRefunds = PaymentCalculationService.round2(totalRefunds + amt);
        } else {
          grossCollections = PaymentCalculationService.round2(grossCollections + amt);
        }
      });
      const netCollections = Math.max(0, PaymentCalculationService.round2(grossCollections - totalRefunds));

      // 2. Collection by Payment Method
      const allMethods: PaymentMethod[] = [
        PaymentMethod.CASH,
        PaymentMethod.UPI,
        PaymentMethod.CARD,
        PaymentMethod.BANK_TRANSFER,
        PaymentMethod.OTHER
      ];

      const methodMap = new Map<PaymentMethod, { amount: number; count: number }>();
      allMethods.forEach(m => methodMap.set(m, { amount: 0, count: 0 }));

      payments.forEach(p => {
        const m = p.paymentMethod;
        const entry = methodMap.get(m) || { amount: 0, count: 0 };
        const amt = Number(p.amount);
        entry.count += 1;
        entry.amount = p.isRefund
          ? PaymentCalculationService.round2(entry.amount - amt)
          : PaymentCalculationService.round2(entry.amount + amt);
        methodMap.set(m, entry);
      });

      const collectionsByMethod = allMethods.map(method => {
        const entry = methodMap.get(method)!;
        const safeAmount = Math.max(0, entry.amount);
        return {
          method,
          amount: safeAmount,
          count: entry.count,
          percentage: netCollections > 0
            ? PaymentCalculationService.round2((safeAmount / netCollections) * 100)
            : 0
        };
      });

      // 3. Payment Status Breakdown
      const statusMap: Record<string, { count: number; netAmount: number; paidAmount: number; balanceAmount: number }> = {
        PAID: { count: 0, netAmount: 0, paidAmount: 0, balanceAmount: 0 },
        PARTIAL: { count: 0, netAmount: 0, paidAmount: 0, balanceAmount: 0 },
        UNPAID: { count: 0, netAmount: 0, paidAmount: 0, balanceAmount: 0 }
      };

      orderPaymentCounts.forEach(stat => {
        const key = stat.paymentStatus;
        if (statusMap[key]) {
          statusMap[key].count = stat._count.id;
          statusMap[key].netAmount = PaymentCalculationService.round2(Number(stat._sum.netAmount || 0));
          statusMap[key].paidAmount = PaymentCalculationService.round2(Number(stat._sum.paidAmount || 0));
          statusMap[key].balanceAmount = PaymentCalculationService.round2(Number(stat._sum.balanceAmount || 0));
        }
      });

      // 4. Daily Collections Timeline
      const timelineMap = new Map<string, { cash: number; digital: number; total: number; count: number }>();
      payments.forEach(p => {
        const dateKey = p.createdAt.toISOString().slice(0, 10);
        const entry = timelineMap.get(dateKey) || { cash: 0, digital: 0, total: 0, count: 0 };
        const amt = p.isRefund ? -Number(p.amount) : Number(p.amount);
        entry.count += 1;
        entry.total = PaymentCalculationService.round2(entry.total + amt);
        if (p.paymentMethod === PaymentMethod.CASH) {
          entry.cash = PaymentCalculationService.round2(entry.cash + amt);
        } else {
          entry.digital = PaymentCalculationService.round2(entry.digital + amt);
        }
        timelineMap.set(dateKey, entry);
      });

      const dailyTimeline = Array.from(timelineMap.entries())
        .map(([date, data]) => ({
          date,
          cash: Math.max(0, data.cash),
          digital: Math.max(0, data.digital),
          total: Math.max(0, data.total),
          count: data.count
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const totalOutstanding = PaymentCalculationService.round2(Number(receivablesAggregate._sum.balanceAmount || 0));
      const overdueReceivables = PaymentCalculationService.round2(Number(overdueAggregate._sum.balanceAmount || 0));

      return res.json({
        success: true,
        data: {
          period: { preset, startDate: startDate.toISOString(), endDate: endDate.toISOString() },
          summary: {
            grossCollections,
            refunds: totalRefunds,
            netCollections,
            transactionCount: payments.length,
            totalOutstanding,
            overdueReceivables
          },
          collectionsByMethod,
          paymentStatusBreakdown: {
            fullyPaid: statusMap.PAID,
            partiallyPaid: statusMap.PARTIAL,
            unpaid: statusMap.UNPAID
          },
          dailyTimeline
        }
      });
    } catch (err) { next(err); }
  }

  // ---------------------------------------------------------------------------
  // 4. Production Reports
  // ---------------------------------------------------------------------------
  static async getProductionReports(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { range, startDate: qStart, endDate: qEnd, branchId } = req.query as {
        range?: string;
        startDate?: string;
        endDate?: string;
        branchId?: string;
      };

      const dateResult = ReportDateUtils.parseDateRange({ range, startDate: qStart, endDate: qEnd });
      if (!dateResult.valid || !dateResult.data) {
        return res.status(400).json({ success: false, error: { message: dateResult.error, code: dateResult.code } });
      }
      const { startDate, endDate, preset } = dateResult.data;

      const branchCheck = await ReportsController.validateBranch(tenantId, branchId);
      if (!branchCheck.valid) {
        return res.status(404).json({ success: false, error: { message: branchCheck.error, code: 'BRANCH_NOT_FOUND' } });
      }

      const branchJobFilter = branchId ? { orderItem: { order: { branchId } } } : {};

      const [stageCountsRaw, delayedJobsList, craftStaff] = await Promise.all([
        // Stage breakdown
        prisma.productionJob.groupBy({
          by: ['currentStage'],
          where: {
            tenantId,
            ...branchJobFilter
          },
          _count: { id: true }
        }),
        // Delayed production jobs
        prisma.productionJob.findMany({
          where: {
            tenantId,
            isDelayed: true,
            currentStage: { not: ProductionStageName.DELIVERED },
            ...branchJobFilter
          },
          include: {
            orderItem: {
              include: {
                garmentType: { select: { name: true } },
                order: { select: { orderNumber: true, deliveryDate: true } }
              }
            },
            assignedTo: { select: { name: true, role: true } }
          },
          take: 20
        }),
        // Craft staff workload
        prisma.user.findMany({
          where: {
            tenantId,
            isActive: true,
            role: { in: [RoleType.CUTTER, RoleType.TAILOR, RoleType.FINISHER] },
            ...(branchId ? { branchId } : {})
          },
          select: {
            id: true,
            name: true,
            role: true,
            _count: {
              select: {
                assignedJobs: {
                  where: { currentStage: { not: ProductionStageName.DELIVERED } }
                }
              }
            }
          }
        })
      ]);

      // 1. All 8 Stages
      const allStages: ProductionStageName[] = [
        ProductionStageName.RECEIVED,
        ProductionStageName.CUTTING,
        ProductionStageName.STITCHING,
        ProductionStageName.FINISHING,
        ProductionStageName.TRIAL,
        ProductionStageName.ALTERATION,
        ProductionStageName.READY,
        ProductionStageName.DELIVERED
      ];

      const stageCountMap = new Map<ProductionStageName, number>();
      allStages.forEach(s => stageCountMap.set(s, 0));
      stageCountsRaw.forEach(sc => {
        stageCountMap.set(sc.currentStage, sc._count.id);
      });

      const totalActiveJobs = Array.from(stageCountMap.entries())
        .filter(([stage]) => stage !== ProductionStageName.DELIVERED)
        .reduce((sum, [, count]) => sum + count, 0);

      const stageCounts = allStages.map(stage => ({
        stage,
        count: stageCountMap.get(stage)!,
        percentage: totalActiveJobs > 0 && stage !== ProductionStageName.DELIVERED
          ? PaymentCalculationService.round2((stageCountMap.get(stage)! / totalActiveJobs) * 100)
          : 0
      }));

      // 2. Delayed Jobs & Delay Reasons
      const reasonCountMap = new Map<string, number>();
      delayedJobsList.forEach(dj => {
        const reason = dj.delayReason?.trim() || 'Unspecified';
        reasonCountMap.set(reason, (reasonCountMap.get(reason) || 0) + 1);
      });

      const delayReasons = Array.from(reasonCountMap.entries()).map(([reason, count]) => ({
        reason,
        count
      })).sort((a, b) => b.count - a.count);

      const delayedJobs = delayedJobsList.map(j => ({
        id: j.id,
        orderNumber: j.orderItem?.order?.orderNumber || 'N/A',
        garmentName: j.orderItem?.garmentType?.name || 'Garment',
        stage: j.currentStage,
        assignedStaff: j.assignedTo?.name || 'Unassigned',
        deliveryDate: j.orderItem?.order?.deliveryDate ? j.orderItem.order.deliveryDate.toISOString() : null,
        delayReason: j.delayReason || 'Unspecified'
      }));

      // 3. Craft Workload
      const craftRoleWorkload: Record<string, { staffCount: number; activeJobs: number }> = {
        CUTTER: { staffCount: 0, activeJobs: 0 },
        TAILOR: { staffCount: 0, activeJobs: 0 },
        FINISHER: { staffCount: 0, activeJobs: 0 }
      };

      craftStaff.forEach(s => {
        const role = s.role as string;
        if (craftRoleWorkload[role]) {
          craftRoleWorkload[role].staffCount += 1;
          craftRoleWorkload[role].activeJobs += s._count.assignedJobs;
        }
      });

      const staffWorkload = craftStaff.map(s => ({
        id: s.id,
        name: s.name,
        role: s.role,
        activeJobs: s._count.assignedJobs
      })).sort((a, b) => b.activeJobs - a.activeJobs);

      return res.json({
        success: true,
        data: {
          period: { preset, startDate: startDate.toISOString(), endDate: endDate.toISOString() },
          summary: {
            totalActiveJobs,
            totalDelayedJobs: delayedJobsList.length,
            readyForHandover: stageCountMap.get(ProductionStageName.READY) || 0,
            completedDelivered: stageCountMap.get(ProductionStageName.DELIVERED) || 0
          },
          stageCounts,
          delayedJobs: {
            total: delayedJobsList.length,
            reasons: delayReasons,
            jobs: delayedJobs
          },
          craftWorkload: {
            byRole: craftRoleWorkload,
            staff: staffWorkload
          }
        }
      });
    } catch (err) { next(err); }
  }

  // ---------------------------------------------------------------------------
  // 5. Customer Reports
  // ---------------------------------------------------------------------------
  static async getCustomerReports(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { range, startDate: qStart, endDate: qEnd } = req.query as {
        range?: string;
        startDate?: string;
        endDate?: string;
      };

      const dateResult = ReportDateUtils.parseDateRange({ range, startDate: qStart, endDate: qEnd });
      if (!dateResult.valid || !dateResult.data) {
        return res.status(400).json({ success: false, error: { message: dateResult.error, code: dateResult.code } });
      }
      const { startDate, endDate, preset } = dateResult.data;

      const [totalCustomers, newCustomers, customers] = await Promise.all([
        prisma.customer.count({ where: { tenantId, isDeleted: false } }),
        prisma.customer.count({ where: { tenantId, isDeleted: false, createdAt: { gte: startDate, lte: endDate } } }),
        prisma.customer.findMany({
          where: { tenantId, isDeleted: false },
          select: {
            id: true,
            customerId: true,
            firstName: true,
            lastName: true,
            mobile: true,
            createdAt: true,
            orders: {
              where: { isCancelled: false },
              select: {
                id: true,
                netAmount: true,
                balanceAmount: true,
                status: true
              }
            }
          }
        })
      ]);

      const customersWithOrders = customers.filter(c => c.orders.length > 0);
      const firstTimeCustomers = customers.filter(c => c.orders.length === 1).length;
      const repeatCustomers = customers.filter(c => c.orders.length >= 2).length;
      const repeatCustomerRate = customersWithOrders.length > 0
        ? PaymentCalculationService.round2((repeatCustomers / customersWithOrders.length) * 100)
        : 0;

      let customersWithBalanceCount = 0;
      let totalReceivables = 0;

      const customerSpendList = customersWithOrders.map(c => {
        const totalSpend = PaymentCalculationService.round2(
          c.orders.reduce((sum, o) => sum + Number(o.netAmount), 0)
        );
        const balanceDue = PaymentCalculationService.round2(
          c.orders.reduce((sum, o) => sum + Number(o.balanceAmount), 0)
        );
        if (balanceDue > 0) {
          customersWithBalanceCount += 1;
          totalReceivables = PaymentCalculationService.round2(totalReceivables + balanceDue);
        }

        return {
          id: c.id,
          customerId: c.customerId,
          name: `${c.firstName} ${c.lastName}`.trim(),
          mobile: c.mobile,
          orderCount: c.orders.length,
          totalSpend,
          balanceDue
        };
      });

      const topCustomers = customerSpendList
        .sort((a, b) => b.totalSpend - a.totalSpend)
        .slice(0, 10);

      return res.json({
        success: true,
        data: {
          period: { preset, startDate: startDate.toISOString(), endDate: endDate.toISOString() },
          summary: {
            totalCustomers,
            newCustomers,
            activeCustomerAccounts: customersWithOrders.length,
            firstTimeCustomers,
            repeatCustomers,
            repeatCustomerRate,
            customersWithBalanceCount,
            totalReceivables
          },
          topCustomers
        }
      });
    } catch (err) { next(err); }
  }

  // ---------------------------------------------------------------------------
  // 6. Staff Operational Reports
  // ---------------------------------------------------------------------------
  static async getStaffReports(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { range, startDate: qStart, endDate: qEnd, branchId } = req.query as {
        range?: string;
        startDate?: string;
        endDate?: string;
        branchId?: string;
      };

      const dateResult = ReportDateUtils.parseDateRange({ range, startDate: qStart, endDate: qEnd });
      if (!dateResult.valid || !dateResult.data) {
        return res.status(400).json({ success: false, error: { message: dateResult.error, code: dateResult.code } });
      }
      const { startDate, endDate, preset } = dateResult.data;

      const branchCheck = await ReportsController.validateBranch(tenantId, branchId);
      if (!branchCheck.valid) {
        return res.status(404).json({ success: false, error: { message: branchCheck.error, code: 'BRANCH_NOT_FOUND' } });
      }

      // Factual operational tallies only: Assigned, Completed in range, Delayed
      // Strict Rule: No ratings, no scores, no productivity grades
      const staffMembers = await prisma.user.findMany({
        where: {
          tenantId,
          isActive: true,
          role: { in: [RoleType.CUTTER, RoleType.TAILOR, RoleType.FINISHER, RoleType.MANAGER] },
          ...(branchId ? { branchId } : {})
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          branch: { select: { name: true } },
          assignedJobs: {
            select: {
              id: true,
              currentStage: true,
              completedDate: true,
              isDelayed: true,
              orderItem: {
                select: {
                  order: { select: { deliveryDate: true, status: true } }
                }
              }
            }
          }
        },
        orderBy: [{ role: 'asc' }, { name: 'asc' }]
      });

      const now = new Date();
      const staffOperational = staffMembers.map(staff => {
        const assignedJobs = staff.assignedJobs.filter(j => j.currentStage !== ProductionStageName.DELIVERED).length;
        const completedJobs = staff.assignedJobs.filter(j =>
          j.completedDate && j.completedDate >= startDate && j.completedDate <= endDate
        ).length;
        const delayedJobs = staff.assignedJobs.filter(j => {
          if (j.currentStage === ProductionStageName.DELIVERED) return false;
          if (j.isDelayed) return true;
          const dueDate = j.orderItem?.order?.deliveryDate;
          return Boolean(dueDate && dueDate < now);
        }).length;

        return {
          id: staff.id,
          name: staff.name,
          email: staff.email,
          role: staff.role,
          branchName: staff.branch?.name || 'Main Branch',
          assignedJobs,
          completedJobs,
          delayedJobs
        };
      });

      return res.json({
        success: true,
        data: {
          period: { preset, startDate: startDate.toISOString(), endDate: endDate.toISOString() },
          staffCount: staffOperational.length,
          staff: staffOperational
        }
      });
    } catch (err) { next(err); }
  }

  // ===========================================================================
  // Legacy / Existing Dashboard Methods (Maintained for Backward Compatibility)
  // ===========================================================================
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
        financialAggregate,
        todayPayments,
        fullyPaidCount,
        partiallyPaidCount,
        unpaidCount
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
        }),
        prisma.payment.findMany({
          where: { tenantId, createdAt: { gte: todayStart, lte: todayEnd } },
          select: { amount: true, isRefund: true }
        }),
        prisma.order.count({ where: { tenantId, paymentStatus: 'PAID', isCancelled: false } }),
        prisma.order.count({ where: { tenantId, paymentStatus: 'PARTIAL', isCancelled: false } }),
        prisma.order.count({ where: { tenantId, paymentStatus: 'UNPAID', isCancelled: false } })
      ]);

      const totalRevenue = Number(financialAggregate._sum.paidAmount || 0);
      const outstandingReceivables = Number(financialAggregate._sum.balanceAmount || 0);

      const todayCollection = Math.max(
        0,
        todayPayments.reduce((sum, p) => p.isRefund ? sum - Number(p.amount) : sum + Number(p.amount), 0)
      );

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
          outstandingReceivables,
          todayCollection,
          fullyPaidCount,
          partiallyPaidCount,
          unpaidCount
        }
      });
    } catch (err) { next(err); }
  }

  static async getManagerDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;

      const stageWorkload = await prisma.productionJob.groupBy({
        by: ['currentStage'],
        where: { tenantId },
        _count: { id: true }
      });

      const delayedJobs = await prisma.productionJob.count({
        where: { tenantId, isDelayed: true, currentStage: { not: ProductionStageName.DELIVERED } }
      });

      const pendingTrials = await prisma.trial.count({
        where: { tenantId, status: 'SCHEDULED' }
      });

      const countsMap: Record<string, number> = {};
      stageWorkload.forEach(sw => {
        countsMap[sw.currentStage] = sw._count?.id || 0;
      });

      return res.json({
        success: true,
        data: {
          stageWorkload,
          delayedJobs,
          pendingTrials,
          pendingCutting: countsMap[ProductionStageName.CUTTING] || 0,
          pendingStitching: countsMap[ProductionStageName.STITCHING] || 0,
          pendingFinishing: countsMap[ProductionStageName.FINISHING] || 0,
          trialPending: countsMap[ProductionStageName.TRIAL] || 0,
          alterationPending: countsMap[ProductionStageName.ALTERATION] || 0,
          readyForDelivery: countsMap[ProductionStageName.READY] || 0
        }
      });
    } catch (err) { next(err); }
  }

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
