import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/prisma';
import { notificationService } from '../notifications/notificationService';
import {
  NotificationChannel,
  OrderStatus,
  ProductionStageName,
  RoleType
} from '@prisma/client';
import {
  ProductionAssignmentService,
  EnrichedStaff
} from './productionAssignmentService';
import {
  ProductionWorkflowService,
  ALLOWED_STAGE_TRANSITIONS
} from './productionWorkflowService';

export class ProductionController {
  /**
   * Kanban Board View with Search, Stage Filter, Role/Staff Filter, Priority, Delay, and Tenant Scoping
   */
  static async getBoard(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const {
        search,
        stage,
        assignedStaffId,
        role,
        isDelayed,
        priority,
        myTasks
      } = req.query;

      // Build production job filter
      const whereClause: any = { tenantId };

      if (stage && Object.values(ProductionStageName).includes(stage as ProductionStageName)) {
        whereClause.currentStage = stage as ProductionStageName;
      }

      if (isDelayed === 'true') {
        whereClause.isDelayed = true;
      }

      // My Tasks shortcut: filters by currently logged-in user
      const targetStaffId = myTasks === 'true' ? req.user?.id : (typeof assignedStaffId === 'string' ? assignedStaffId : undefined);

      if (targetStaffId && typeof targetStaffId === 'string') {
        whereClause.OR = [
          { assignedToId: targetStaffId },
          { notes: { contains: targetStaffId } }
        ];
      }

      // Filter by Order Priority or Search Keyword
      const orderItemWhere: any = {};
      const orderWhere: any = {};

      if (priority && typeof priority === 'string') {
        orderWhere.priority = priority.toUpperCase();
      }

      if (search && typeof search === 'string' && search.trim()) {
        const query = search.trim();
        orderWhere.OR = [
          { orderNumber: { contains: query, mode: 'insensitive' } },
          { customer: { firstName: { contains: query, mode: 'insensitive' } } },
          { customer: { lastName: { contains: query, mode: 'insensitive' } } },
          { customer: { mobile: { contains: query } } }
        ];
      }

      if (Object.keys(orderWhere).length > 0) {
        orderItemWhere.order = orderWhere;
      }

      if (Object.keys(orderItemWhere).length > 0) {
        whereClause.orderItem = orderItemWhere;
      }

      // Fetch all tenant staff for craft assignment lookup map
      const tenantStaff = await prisma.user.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true, role: true, phone: true }
      });
      const staffMap = new Map<string, EnrichedStaff>();
      tenantStaff.forEach((s) => staffMap.set(s.id, s));

      const jobs = await prisma.productionJob.findMany({
        where: whereClause,
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
                  status: true,
                  totalAmount: true,
                  discountAmount: true,
                  gstAmount: true,
                  netAmount: true,
                  paidAmount: true,
                  balanceAmount: true,
                  paymentStatus: true,
                  customer: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      mobile: true,
                      email: true
                    }
                  }
                }
              },
              measurementSnapshot: true
            }
          }
        },
        orderBy: [
          { isDelayed: 'desc' },
          { orderItem: { order: { priority: 'desc' } } },
          { orderItem: { order: { deliveryDate: 'asc' } } },
          { updatedAt: 'desc' }
        ]
      });

      // Filter by craft role if requested (e.g. CUTTER, TAILOR, FINISHER)
      let enrichedJobs = jobs.map((job) =>
        ProductionAssignmentService.enrichJobWithAssignments(job, staffMap)
      );

      if (role && typeof role === 'string') {
        const targetRole = role.toUpperCase();
        if (targetRole === 'CUTTER') {
          enrichedJobs = enrichedJobs.filter(
            (j) => j.assignments.cutter?.id === targetStaffId || j.currentStage === ProductionStageName.CUTTING
          );
        } else if (targetRole === 'TAILOR') {
          enrichedJobs = enrichedJobs.filter(
            (j) =>
              j.assignments.tailor?.id === targetStaffId ||
              j.currentStage === ProductionStageName.STITCHING ||
              j.currentStage === ProductionStageName.ALTERATION
          );
        } else if (targetRole === 'FINISHER') {
          enrichedJobs = enrichedJobs.filter(
            (j) => j.assignments.finisher?.id === targetStaffId || j.currentStage === ProductionStageName.FINISHING
          );
        }
      }

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

      enrichedJobs.forEach((job) => {
        if (stages[job.currentStage]) {
          stages[job.currentStage].push(job);
        }
      });

      const totalJobs = enrichedJobs.length;
      const delayedCount = enrichedJobs.filter((j) => j.isDelayed).length;

      return res.json({
        success: true,
        data: stages,
        meta: {
          totalJobs,
          delayedCount
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get Single Production Job Details (including frozen measurement snapshot and stage history)
   */
  static async getJobById(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { jobId } = req.params;

      const job = await prisma.productionJob.findFirst({
        where: { id: jobId, tenantId },
        include: {
          assignedTo: { select: { id: true, name: true, role: true, phone: true } },
          history: {
            orderBy: { createdAt: 'desc' }
          },
          orderItem: {
            include: {
              garmentType: true,
              styles: {
                include: { style: true }
              },
              measurementSnapshot: true, // IMMUTABLE historical snapshot frozen at order creation
              order: {
                select: {
                  id: true,
                  orderNumber: true,
                  priority: true,
                  deliveryDate: true,
                  revisedDeliveryDate: true,
                  status: true,
                  createdAt: true,
                  totalAmount: true,
                  discountAmount: true,
                  gstAmount: true,
                  netAmount: true,
                  paidAmount: true,
                  balanceAmount: true,
                  paymentStatus: true,
                  customer: {
                    select: {
                      id: true,
                      customerId: true,
                      firstName: true,
                      lastName: true,
                      mobile: true,
                      email: true,
                      city: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!job) {
        return res.status(404).json({
          success: false,
          error: { message: 'Production job not found in this shop', code: 'JOB_NOT_FOUND' }
        });
      }

      // Fetch tenant staff for assignment enrichment
      const tenantStaff = await prisma.user.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true, role: true, phone: true }
      });
      const staffMap = new Map<string, EnrichedStaff>();
      tenantStaff.forEach((s) => staffMap.set(s.id, s));

      // Fetch related audit logs for the job
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          tenantId,
          entity: 'ProductionJob',
          entityId: jobId
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      const enrichedJob = ProductionAssignmentService.enrichJobWithAssignments(job, staffMap);

      return res.json({
        success: true,
        data: {
          ...enrichedJob,
          auditLogs
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Assign Staff (Cutter, Tailor, Finisher) with Role Validation & Tenant Security
   */
  static async assignStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const { jobId } = req.params;
      const { cutterId, tailorId, finisherId, staffId, notes } = req.body;
      const tenantId = req.tenantId!;

      const existingJob = await prisma.productionJob.findFirst({
        where: { id: jobId, tenantId },
        include: {
          orderItem: { include: { order: true, garmentType: true } }
        }
      });

      if (!existingJob) {
        return res.status(404).json({
          success: false,
          error: { message: 'Production job not found', code: 'JOB_NOT_FOUND' }
        });
      }

      // 1. Validate Cutter
      if (cutterId) {
        const cutter = await prisma.user.findFirst({
          where: { id: cutterId, tenantId, isActive: true }
        });
        if (!cutter) {
          return res.status(400).json({
            success: false,
            error: { message: 'Assigned cutter not found in this shop', code: 'STAFF_NOT_FOUND' }
          });
        }
        const validation = ProductionAssignmentService.validateCraftsmanRole(cutter, 'CUTTER');
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            error: { message: validation.error, code: 'INVALID_CRAFT_ROLE' }
          });
        }
      }

      // 2. Validate Tailor
      if (tailorId) {
        const tailor = await prisma.user.findFirst({
          where: { id: tailorId, tenantId, isActive: true }
        });
        if (!tailor) {
          return res.status(400).json({
            success: false,
            error: { message: 'Assigned tailor not found in this shop', code: 'STAFF_NOT_FOUND' }
          });
        }
        const validation = ProductionAssignmentService.validateCraftsmanRole(tailor, 'TAILOR');
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            error: { message: validation.error, code: 'INVALID_CRAFT_ROLE' }
          });
        }
      }

      // 3. Validate Finisher
      if (finisherId) {
        const finisher = await prisma.user.findFirst({
          where: { id: finisherId, tenantId, isActive: true }
        });
        if (!finisher) {
          return res.status(400).json({
            success: false,
            error: { message: 'Assigned finisher not found in this shop', code: 'STAFF_NOT_FOUND' }
          });
        }
        const validation = ProductionAssignmentService.validateCraftsmanRole(finisher, 'FINISHER');
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            error: { message: validation.error, code: 'INVALID_CRAFT_ROLE' }
          });
        }
      }

      // 4. Validate Direct staffId fallback
      if (staffId && !cutterId && !tailorId && !finisherId) {
        const directStaff = await prisma.user.findFirst({
          where: { id: staffId, tenantId, isActive: true }
        });
        if (!directStaff) {
          return res.status(400).json({
            success: false,
            error: { message: 'Assigned staff member not found in this shop', code: 'STAFF_NOT_FOUND' }
          });
        }
      }

      // Parse existing craft assignments
      const parsedNotes = ProductionAssignmentService.parseNotesAndAssignments(existingJob.notes);
      const updatedAssignments = {
        cutterId: cutterId !== undefined ? (cutterId || null) : parsedNotes.assignments.cutterId,
        tailorId: tailorId !== undefined ? (tailorId || null) : parsedNotes.assignments.tailorId,
        finisherId: finisherId !== undefined ? (finisherId || null) : parsedNotes.assignments.finisherId
      };

      // Determine active assignedToId based on current stage
      const stageCraftsman = ProductionWorkflowService.getCraftsmanForStage(
        existingJob.currentStage,
        updatedAssignments
      );
      const newAssignedToId = stageCraftsman || staffId || existingJob.assignedToId;

      const serializedNotes = ProductionAssignmentService.serializeNotesAndAssignments(
        notes !== undefined ? notes : parsedNotes.userNotes,
        updatedAssignments
      );

      const updatedJob = await prisma.$transaction(async (tx) => {
        const job = await tx.productionJob.update({
          where: { id: jobId },
          data: {
            assignedToId: newAssignedToId || null,
            assignedDate: newAssignedToId ? new Date() : null,
            notes: serializedNotes
          },
          include: {
            assignedTo: { select: { id: true, name: true, role: true } },
            orderItem: {
              include: {
                garmentType: true,
                order: { select: { orderNumber: true } }
              }
            }
          }
        });

        // Audit Trail
        await tx.auditLog.create({
          data: {
            tenantId,
            userId: req.user?.id,
            action: 'PRODUCTION_STAFF_ASSIGNED',
            entity: 'ProductionJob',
            entityId: jobId,
            details: {
              jobId,
              orderNumber: existingJob.orderItem.order.orderNumber,
              garment: existingJob.orderItem.garmentType.name,
              assignments: updatedAssignments,
              assignedToId: newAssignedToId
            }
          }
        });

        return job;
      });

      // Construct enriched return object
      const tenantStaff = await prisma.user.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true, role: true, phone: true }
      });
      const staffMap = new Map<string, EnrichedStaff>();
      tenantStaff.forEach((s) => staffMap.set(s.id, s));

      const enrichedJob = ProductionAssignmentService.enrichJobWithAssignments(updatedJob, staffMap);

      return res.json({ success: true, data: enrichedJob });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update Production Stage with Canonical Transition Validation, Delay Reason Gate & Order Status Sync
   */
  static async updateStage(req: Request, res: Response, next: NextFunction) {
    try {
      const { jobId } = req.params;
      const {
        stage,
        isDelayed,
        delayReason,
        revisedDeliveryDate,
        notes,
        forceTransition,
        overrideReason
      } = req.body;
      const tenantId = req.tenantId!;

      const existingJob = await prisma.productionJob.findFirst({
        where: { id: jobId, tenantId },
        include: {
          orderItem: {
            include: {
              order: { include: { customer: true } },
              garmentType: true
            }
          }
        }
      });

      if (!existingJob) {
        return res.status(404).json({
          success: false,
          error: { message: 'Job not found', code: 'JOB_NOT_FOUND' }
        });
      }

      const fromStage = existingJob.currentStage;
      const toStage = (stage as ProductionStageName) || fromStage;

      // DELIVERED Stage Protection:
      // Moving a DELIVERED job backwards is strictly blocked in normal transitions.
      // Must use explicit "Customer Returned for Alteration" endpoint.
      if (fromStage === ProductionStageName.DELIVERED && toStage !== ProductionStageName.DELIVERED) {
        return res.status(400).json({
          success: false,
          error: {
            message:
              'A delivered garment cannot be moved backward via standard stage updates. Use the explicit "Customer Returned for Alteration" action.',
            code: 'USE_RETURN_FOR_ALTERATION'
          }
        });
      }

      // Canonical Transition Validation:
      const isValidTransition = ProductionWorkflowService.isValidStageTransition(fromStage, toStage);
      if (!isValidTransition) {
        const isManagerOrOwner =
          req.user?.role === RoleType.SHOP_OWNER || req.user?.role === RoleType.MANAGER;

        if (forceTransition && isManagerOrOwner) {
          if (!overrideReason || !overrideReason.trim()) {
            return res.status(400).json({
              success: false,
              error: {
                message: 'An explicit override reason is mandatory when bypassing canonical workflow stages.',
                code: 'OVERRIDE_REASON_REQUIRED'
              }
            });
          }
        } else {
          const allowedNext = ALLOWED_STAGE_TRANSITIONS[fromStage] || [];
          return res.status(400).json({
            success: false,
            error: {
              message: `Invalid stage transition from "${fromStage}" to "${toStage}". Allowed transitions from ${fromStage} are: [${allowedNext.join(', ')}].`,
              code: 'INVALID_STAGE_TRANSITION',
              allowedTransitions: allowedNext
            }
          });
        }
      }

      // Enforced Delay Rule:
      // A delayed order CANNOT be saved without Delay Reason AND Revised Delivery Date!
      if (isDelayed || revisedDeliveryDate) {
        if (!delayReason || !delayReason.trim()) {
          return res.status(400).json({
            success: false,
            error: {
              message: 'Delay reason is mandatory when marking a job as delayed or revising the delivery date.',
              code: 'MISSING_DELAY_REASON'
            }
          });
        }
        if (!revisedDeliveryDate && !existingJob.revisedDeliveryDate) {
          return res.status(400).json({
            success: false,
            error: {
              message: 'Revised delivery date is mandatory when marking a job as delayed.',
              code: 'MISSING_REVISED_DATE'
            }
          });
        }
      }

      // Automatically sync assignedToId to the craftsman responsible for target stage
      const parsedNotes = ProductionAssignmentService.parseNotesAndAssignments(existingJob.notes);
      const stageCraftsman = ProductionWorkflowService.getCraftsmanForStage(toStage, parsedNotes.assignments);
      const newAssignedToId = stageCraftsman || existingJob.assignedToId;

      // Update userNotes if provided
      let finalSerializedNotes = existingJob.notes;
      if (notes !== undefined) {
        finalSerializedNotes = ProductionAssignmentService.serializeNotesAndAssignments(
          notes,
          parsedNotes.assignments
        );
      }

      const updatedJob = await prisma.$transaction(async (tx) => {
        const job = await tx.productionJob.update({
          where: { id: jobId },
          data: {
            currentStage: toStage,
            assignedToId: newAssignedToId || null,
            isDelayed: isDelayed !== undefined ? isDelayed : existingJob.isDelayed,
            delayReason: delayReason || existingJob.delayReason,
            revisedDeliveryDate: revisedDeliveryDate
              ? new Date(revisedDeliveryDate)
              : existingJob.revisedDeliveryDate,
            startedDate:
              toStage === ProductionStageName.CUTTING && !existingJob.startedDate
                ? new Date()
                : existingJob.startedDate,
            completedDate:
              toStage === ProductionStageName.DELIVERED ? new Date() : existingJob.completedDate,
            notes: finalSerializedNotes
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
            delayReason: delayReason || null,
            notes: forceTransition
              ? `[FORCED OVERRIDE: ${overrideReason}] ${notes || ''}`
              : (notes || null)
          }
        });

        // Synchronize Master Order Status across all items with strict precedence rules
        const allItems = await tx.orderItem.findMany({
          where: { orderId: existingJob.orderItem.orderId },
          select: { status: true }
        });

        const newOrderStatus = ProductionWorkflowService.calculateMasterOrderStatus(allItems);

        await tx.order.update({
          where: { id: existingJob.orderItem.orderId },
          data: {
            status: newOrderStatus,
            delayReason: isDelayed ? delayReason : undefined,
            revisedDeliveryDate: revisedDeliveryDate ? new Date(revisedDeliveryDate) : undefined
          }
        });

        // Audit Trail
        await tx.auditLog.create({
          data: {
            tenantId,
            userId: req.user?.id,
            action: 'PRODUCTION_STAGE_UPDATED',
            entity: 'ProductionJob',
            entityId: jobId,
            details: {
              jobId,
              orderNumber: existingJob.orderItem.order.orderNumber,
              garment: existingJob.orderItem.garmentType.name,
              fromStage,
              toStage,
              newOrderStatus,
              isDelayed: isDelayed !== undefined ? isDelayed : existingJob.isDelayed,
              delayReason: delayReason || null,
              isForced: !!forceTransition,
              overrideReason: overrideReason || null
            }
          }
        });

        return job;
      });

      // Send event notifications if configured
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
          message: `Dear ${customer.firstName}, delivery for order ${existingJob.orderItem.order.orderNumber} has been updated to ${new Date(
            revisedDeliveryDate
          ).toLocaleDateString()}. Reason: ${delayReason}.`
        });
      }

      // Construct enriched return object
      const tenantStaff = await prisma.user.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true, role: true, phone: true }
      });
      const staffMap = new Map<string, EnrichedStaff>();
      tenantStaff.forEach((s) => staffMap.set(s.id, s));

      const enrichedJob = ProductionAssignmentService.enrichJobWithAssignments(updatedJob, staffMap);

      return res.json({ success: true, data: enrichedJob });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Explicit Customer Returned for Alteration Action (DELIVERED -> ALTERATION)
   */
  static async returnForAlteration(req: Request, res: Response, next: NextFunction) {
    try {
      const { jobId } = req.params;
      const { reason, notes } = req.body;
      const tenantId = req.tenantId!;

      if (!reason || !reason.trim()) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'A detailed reason is mandatory when customer returns a garment for alteration.',
            code: 'MISSING_RETURN_REASON'
          }
        });
      }

      const existingJob = await prisma.productionJob.findFirst({
        where: { id: jobId, tenantId },
        include: {
          orderItem: {
            include: {
              order: { include: { customer: true } },
              garmentType: true
            }
          }
        }
      });

      if (!existingJob) {
        return res.status(404).json({
          success: false,
          error: { message: 'Job not found', code: 'JOB_NOT_FOUND' }
        });
      }

      if (existingJob.currentStage !== ProductionStageName.DELIVERED) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Only delivered garments can be processed as customer return for alteration.',
            code: 'JOB_NOT_DELIVERED'
          }
        });
      }

      // Check if tailor is assigned, switch assignedToId to tailor
      const parsedNotes = ProductionAssignmentService.parseNotesAndAssignments(existingJob.notes);
      const tailorId = parsedNotes.assignments.tailorId || existingJob.assignedToId;

      const updatedJob = await prisma.$transaction(async (tx) => {
        const job = await tx.productionJob.update({
          where: { id: jobId },
          data: {
            currentStage: ProductionStageName.ALTERATION,
            assignedToId: tailorId,
            completedDate: null
          }
        });

        await tx.orderItem.update({
          where: { id: existingJob.orderItemId },
          data: { status: ProductionStageName.ALTERATION }
        });

        await tx.productionStageHistory.create({
          data: {
            tenantId,
            productionJobId: job.id,
            fromStage: ProductionStageName.DELIVERED,
            toStage: ProductionStageName.ALTERATION,
            transitionedById: req.user?.id,
            notes: `[CUSTOMER RETURNED FOR ALTERATION]: ${reason.trim()} ${notes ? `(${notes.trim()})` : ''}`
          }
        });

        // Set master order status to ALTERATION_PENDING
        await tx.order.update({
          where: { id: existingJob.orderItem.orderId },
          data: { status: OrderStatus.ALTERATION_PENDING }
        });

        // Audit Log
        await tx.auditLog.create({
          data: {
            tenantId,
            userId: req.user?.id,
            action: 'JOB_RETURNED_FOR_ALTERATION',
            entity: 'ProductionJob',
            entityId: jobId,
            details: {
              jobId,
              orderNumber: existingJob.orderItem.order.orderNumber,
              garment: existingJob.orderItem.garmentType.name,
              reason: reason.trim(),
              notes: notes || null,
              initiatedById: req.user?.id,
              initiatedByName: req.user?.name,
              timestamp: new Date().toISOString()
            }
          }
        });

        return job;
      });

      // Construct enriched return object
      const tenantStaff = await prisma.user.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true, role: true, phone: true }
      });
      const staffMap = new Map<string, EnrichedStaff>();
      tenantStaff.forEach((s) => staffMap.set(s.id, s));

      const enrichedJob = ProductionAssignmentService.enrichJobWithAssignments(updatedJob, staffMap);

      return res.json({ success: true, data: enrichedJob });
    } catch (err) {
      next(err);
    }
  }
}
