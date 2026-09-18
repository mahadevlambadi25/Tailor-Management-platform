import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/prisma';
import { notificationService } from '../notifications/notificationService';
import { NotificationChannel, OrderStatus, ProductionStageName } from '@prisma/client';

export class ProductionController {
  // Kanban board view
  static async getBoard(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const jobs = await prisma.productionJob.findMany({
        where: { tenantId },
        include: {
          assignedTo: { select: { id: true, name: true, role: true } },
          orderItem: {
            include: {
              garmentType: true,
              order: {
                select: {
                  id: true,
                  orderNumber: true,
                  priority: true,
                  deliveryDate: true,
                  revisedDeliveryDate: true,
                  customer: { select: { id: true, firstName: true, lastName: true, mobile: true } }
                }
              },
              measurementSnapshot: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      // Group jobs by stage
      const stages: Record<string, any[]> = {
        RECEIVED: [],
        CUTTING: [],
        STITCHING: [],
        FINISHING: [],
        TRIAL: [],
        ALTERATION: [],
        READY: [],
        DELIVERED: []
      };

      jobs.forEach(job => {
        if (stages[job.currentStage]) {
          stages[job.currentStage].push(job);
        }
      });

      return res.json({ success: true, data: stages });
    } catch (err) { next(err); }
  }

  // Assign staff manually to job
  static async assignStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const { jobId } = req.params;
      const { staffId } = req.body;
      const tenantId = req.tenantId!;

      const existingJob = await prisma.productionJob.findFirst({
        where: { id: jobId, tenantId }
      });
      if (!existingJob) {
        return res.status(404).json({ success: false, error: { message: 'Production job not found' } });
      }

      if (staffId) {
        const staff = await prisma.user.findFirst({
          where: { id: staffId, tenantId, isActive: true }
        });
        if (!staff) {
          return res.status(400).json({ success: false, error: { message: 'Assigned staff member not found in this shop' } });
        }
      }

      const job = await prisma.productionJob.update({
        where: { id: jobId },
        data: {
          assignedToId: staffId || null,
          assignedDate: staffId ? new Date() : null
        },
        include: { assignedTo: true }
      });

      return res.json({ success: true, data: job });
    } catch (err) { next(err); }
  }

  // Update production stage with delay reason & revised date validation!
  static async updateStage(req: Request, res: Response, next: NextFunction) {
    try {
      const { jobId } = req.params;
      const { stage, isDelayed, delayReason, revisedDeliveryDate, notes } = req.body;
      const tenantId = req.tenantId!;

      // Enforced Delay Rule from PDF:
      // A delayed order CANNOT be saved without Delay Reason AND Revised Delivery Date!
      if (isDelayed) {
        if (!delayReason || !delayReason.trim()) {
          return res.status(400).json({
            success: false,
            error: { message: 'Delay reason is mandatory when marking a job or order as delayed.', code: 'MISSING_DELAY_REASON' }
          });
        }
        if (!revisedDeliveryDate) {
          return res.status(400).json({
            success: false,
            error: { message: 'Revised delivery date is mandatory when marking a job or order as delayed.', code: 'MISSING_REVISED_DATE' }
          });
        }
      }

      const existingJob = await prisma.productionJob.findFirst({
        where: { id: jobId, tenantId },
        include: { orderItem: { include: { order: { include: { customer: true } } } } }
      });

      if (!existingJob) {
        return res.status(404).json({ success: false, error: { message: 'Job not found' } });
      }

      const fromStage = existingJob.currentStage;
      const toStage = (stage as ProductionStageName) || fromStage;

      const updatedJob = await prisma.$transaction(async (tx) => {
        const job = await tx.productionJob.update({
          where: { id: jobId },
          data: {
            currentStage: toStage,
            isDelayed: isDelayed !== undefined ? isDelayed : existingJob.isDelayed,
            delayReason: delayReason || existingJob.delayReason,
            revisedDeliveryDate: revisedDeliveryDate ? new Date(revisedDeliveryDate) : existingJob.revisedDeliveryDate,
            startedDate: toStage === ProductionStageName.CUTTING && !existingJob.startedDate ? new Date() : existingJob.startedDate,
            completedDate: toStage === ProductionStageName.DELIVERED ? new Date() : existingJob.completedDate,
            notes: notes || existingJob.notes
          }
        });

        // Update item stage
        await tx.orderItem.update({
          where: { id: existingJob.orderItemId },
          data: { status: toStage }
        });

        // Record stage history
        await tx.productionStageHistory.create({
          data: {
            tenantId,
            productionJobId: job.id,
            fromStage,
            toStage,
            transitionedById: req.user?.id,
            delayReason,
            notes
          }
        });

        // If all items are READY or DELIVERED, update master order status
        const allItems = await tx.orderItem.findMany({
          where: { orderId: existingJob.orderItem.orderId }
        });
        const allReady = allItems.every(i => i.status === ProductionStageName.READY || i.status === ProductionStageName.DELIVERED);
        const allDelivered = allItems.every(i => i.status === ProductionStageName.DELIVERED);

        let newOrderStatus: OrderStatus = OrderStatus.IN_PROGRESS;
        if (allDelivered) newOrderStatus = OrderStatus.DELIVERED;
        else if (allReady) newOrderStatus = OrderStatus.READY_FOR_PICKUP;
        else if (toStage === ProductionStageName.TRIAL) newOrderStatus = OrderStatus.TRIAL_PENDING;
        else if (toStage === ProductionStageName.ALTERATION) newOrderStatus = OrderStatus.ALTERATION_PENDING;

        await tx.order.update({
          where: { id: existingJob.orderItem.orderId },
          data: {
            status: newOrderStatus,
            delayReason: isDelayed ? delayReason : undefined,
            revisedDeliveryDate: revisedDeliveryDate ? new Date(revisedDeliveryDate) : undefined
          }
        });

        return job;
      });

      // Send event notifications
      const customer = existingJob.orderItem.order.customer;
      if (toStage === ProductionStageName.READY) {
        await notificationService.send({
          tenantId,
          customerId: customer.id,
          eventType: 'READY_FOR_PICKUP',
          recipient: customer.mobile,
          channel: NotificationChannel.SMS,
          title: 'Your Garment is Ready!',
          message: `Hello ${customer.firstName}, your item from order ${existingJob.orderItem.order.orderNumber} is ready for pickup.`
        });
      } else if (toStage === ProductionStageName.TRIAL) {
        await notificationService.send({
          tenantId,
          customerId: customer.id,
          eventType: 'READY_FOR_TRIAL',
          recipient: customer.mobile,
          channel: NotificationChannel.SMS,
          title: 'Fitting / Trial Ready',
          message: `Hello ${customer.firstName}, your trial fitting for order ${existingJob.orderItem.order.orderNumber} is ready.`
        });
      } else if (isDelayed) {
        await notificationService.send({
          tenantId,
          customerId: customer.id,
          eventType: 'ORDER_DELAYED',
          recipient: customer.mobile,
          channel: NotificationChannel.SMS,
          title: 'Order Schedule Update',
          message: `Dear ${customer.firstName}, delivery for order ${existingJob.orderItem.order.orderNumber} has been updated to ${new Date(revisedDeliveryDate).toLocaleDateString()}. Reason: ${delayReason}.`
        });
      }

      return res.json({ success: true, data: updatedJob });
    } catch (err) { next(err); }
  }
}
