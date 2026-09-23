import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/prisma';
import { notificationService } from '../notifications/notificationService';
import { NotificationChannel, OrderStatus, PaymentMethod, PaymentStatus, ProductionStageName, RoleType, UnitSystem } from '@prisma/client';
import { PaymentCalculationService } from '../payments/paymentCalculationService';

export class OrdersController {
  // List Orders with rich filtering
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, customerId, branchId, tailorId, deliveryDate, search, page = '1', limit = '20' } = req.query;
      const tenantId = req.tenantId!;
      const take = parseInt(limit as string, 10);
      const skip = (parseInt(page as string, 10) - 1) * take;

      const whereClause: any = { tenantId };

      if (status) whereClause.status = status as OrderStatus;
      if (customerId) whereClause.customerId = customerId as string;
      if (branchId) whereClause.branchId = branchId as string;

      if (deliveryDate) {
        const d = new Date(deliveryDate as string);
        if (!isNaN(d.getTime())) {
          const start = new Date(d);
          start.setHours(0, 0, 0, 0);
          const end = new Date(d);
          end.setHours(23, 59, 59, 999);
          whereClause.deliveryDate = {
            gte: start,
            lte: end
          };
        }
      }

      if (search) {
        const q = (search as string).trim();
        const orConditions: any[] = [
          { orderNumber: { contains: q, mode: 'insensitive' } },
          { customer: { firstName: { contains: q, mode: 'insensitive' } } },
          { customer: { lastName: { contains: q, mode: 'insensitive' } } },
          { customer: { mobile: { contains: q } } },
          { customer: { customerId: { contains: q, mode: 'insensitive' } } }
        ];

        // Multi-word customer name search (e.g. "Rajesh Kumar")
        const terms = q.split(/\s+/).filter(Boolean);
        if (terms.length > 1) {
          orConditions.push({
            customer: {
              AND: terms.map(term => ({
                OR: [
                  { firstName: { contains: term, mode: 'insensitive' } },
                  { lastName: { contains: term, mode: 'insensitive' } }
                ]
              }))
            }
          });
        }

        whereClause.OR = orConditions;
      }

      if (tailorId) {
        whereClause.items = {
          some: { productionJob: { assignedToId: tailorId as string } }
        };
      }

      const [total, orders] = await Promise.all([
        prisma.order.count({ where: whereClause }),
        prisma.order.findMany({
          where: whereClause,
          include: {
            customer: { select: { id: true, customerId: true, firstName: true, lastName: true, mobile: true } },
            items: {
              include: {
                garmentType: true,
                measurementSnapshot: true,
                productionJob: { include: { assignedTo: { select: { id: true, name: true, role: true } } } }
              }
            },
            payments: true
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take
        })
      ]);

      return res.json({
        success: true,
        data: {
          orders,
          pagination: { total, page: parseInt(page as string, 10), limit: take, pages: Math.ceil(total / take) }
        }
      });
    } catch (err) { next(err); }
  }

  // Get Order By ID (includes items, snapshots, styles, payments, and audit logs)
  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;

      const order = await prisma.order.findFirst({
        where: { id, tenantId },
        include: {
          customer: true,
          branch: true,
          items: {
            include: {
              garmentType: true,
              measurementSnapshot: true,
              styles: { include: { style: true } },
              productionJob: {
                include: {
                  assignedTo: { select: { id: true, name: true, role: true } },
                  history: true
                }
              },
              trials: { include: { alterations: true } }
            }
          },
          payments: {
            include: { receipts: true },
            orderBy: { createdAt: 'desc' }
          },
          invoices: true
        }
      });

      if (!order) {
        return res.status(404).json({ success: false, error: { message: 'Order not found or access denied.', code: 'ORDER_NOT_FOUND' } });
      }

      // Enrich payments with recordedBy staff details
      const staffIds = order.payments.map((p) => p.recordedById).filter(Boolean) as string[];
      const staffMembers = staffIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: staffIds }, tenantId },
            select: { id: true, name: true, role: true }
          })
        : [];
      const staffMap = new Map(staffMembers.map((s) => [s.id, s]));

      const enrichedPayments = order.payments.map((p) => ({
        ...p,
        recordedBy: p.recordedById ? staffMap.get(p.recordedById) || null : null
      }));

      // Fetch audit logs for the order lifecycle timeline
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          tenantId,
          entity: 'Order',
          entityId: id
        },
        include: {
          user: { select: { name: true, role: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      return res.json({
        success: true,
        data: {
          ...order,
          payments: enrichedPayments,
          auditLogs
        }
      });
    } catch (err) { next(err); }
  }

  // Create Multi-Item Order with Pricing & Advance Payment
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const {
        customerId,
        branchId,
        deliveryDate,
        priority = 'REGULAR',
        items,
        discountType = 'FIXED',
        discountValue = 0,
        gstRate = 0,
        isGstInclusive = false,
        advancePayment,
        internalNotes,
        customerNotes
      } = req.body;

      if (!customerId || !deliveryDate || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: { message: 'Missing required order fields (customerId, deliveryDate, or items array)', code: 'MISSING_FIELDS' }
        });
      }

      // Strictly verify customer exists in tenant and is active
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, tenantId, isDeleted: false }
      });
      if (!customer) {
        return res.status(404).json({
          success: false,
          error: { message: 'Customer not found or does not belong to this shop.', code: 'CUSTOMER_NOT_FOUND' }
        });
      }

      // 1. Calculate Totals for items
      let totalAmount = 0;
      const parsedItems = items.map(item => {
        const itemPrice = Number(item.itemPrice || 0);
        const stitchingCharge = Number(item.stitchingCharge || 0);
        const fabricCharge = Number(item.fabricCharge || 0);
        const designCharge = Number(item.designCharge || 0);
        const alterationCharge = Number(item.alterationCharge || 0);
        const urgentCharge = Number(item.urgentCharge || 0);
        const otherCharge = Number(item.otherCharge || 0);
        const quantity = item.quantity ? parseInt(item.quantity, 10) : 1;

        const totalItemPrice = (itemPrice + stitchingCharge + fabricCharge + designCharge + alterationCharge + urgentCharge + otherCharge) * quantity;
        totalAmount += totalItemPrice;

        return {
          garmentTypeId: item.garmentTypeId,
          itemPrice,
          stitchingCharge,
          fabricCharge,
          designCharge,
          alterationCharge,
          urgentCharge,
          otherCharge,
          quantity,
          totalItemPrice,
          internalNotes: item.internalNotes,
          customerNotes: item.customerNotes,
          measurementSnapshot: item.measurementSnapshot,
          styleOptions: item.styleOptions
        };
      });

      // 2. Calculate Discount
      let discountAmount = 0;
      if (discountType === 'PERCENTAGE') {
        discountAmount = (totalAmount * Number(discountValue)) / 100;
      } else {
        discountAmount = Number(discountValue);
      }
      if (discountAmount > totalAmount) discountAmount = totalAmount;

      const subtotalAfterDiscount = totalAmount - discountAmount;

      // 3. Calculate GST
      let gstAmount = 0;
      let netAmount = subtotalAfterDiscount;
      const rateNum = Number(gstRate);

      if (rateNum > 0) {
        if (isGstInclusive) {
          gstAmount = subtotalAfterDiscount - (subtotalAfterDiscount / (1 + rateNum / 100));
          netAmount = subtotalAfterDiscount;
        } else {
          gstAmount = (subtotalAfterDiscount * rateNum) / 100;
          netAmount = subtotalAfterDiscount + gstAmount;
        }
      }

      // 4. Advance Payment handling
      let paidAmount = 0;
      const advance = advancePayment ? Number(advancePayment.amount || 0) : 0;
      if (advance > 0) {
        paidAmount = advance;
      }

      const balanceAmount = netAmount - paidAmount;
      let paymentStatus: PaymentStatus = PaymentStatus.UNPAID;
      if (paidAmount >= netAmount && netAmount > 0) {
        paymentStatus = paidAmount > netAmount ? PaymentStatus.OVERPAID : PaymentStatus.PAID;
      } else if (paidAmount > 0) {
        paymentStatus = PaymentStatus.PARTIAL;
      }

      // 5. Generate Order with collision-safe sequence and concurrency retry
      const year = new Date().getFullYear();
      let createdOrder: any = null;
      let attempts = 0;
      const baseOrderCount = await prisma.order.count({ where: { tenantId } });

      while (attempts < 5 && !createdOrder) {
        attempts++;
        const candidateSeq = 1001 + baseOrderCount + (attempts - 1);
        const orderNumber = `ORD-${year}-${candidateSeq.toString()}`;

        try {
          createdOrder = await prisma.$transaction(async (tx) => {
            const order = await tx.order.create({
              data: {
                tenantId,
                orderNumber,
                branchId: branchId || null,
                customerId,
                status: OrderStatus.RECEIVED,
                priority,
                deliveryDate: new Date(deliveryDate),
                totalAmount,
                discountType,
                discountValue: Number(discountValue),
                discountAmount,
                netAmount,
                gstRate: rateNum,
                gstAmount,
                isGstInclusive,
                paidAmount,
                balanceAmount,
                paymentStatus,
                internalNotes,
                customerNotes
              }
            });

            // Create Order Items and Snapshots
            for (const item of parsedItems) {
              const orderItem = await tx.orderItem.create({
                data: {
                  tenantId,
                  orderId: order.id,
                  garmentTypeId: item.garmentTypeId,
                  itemPrice: item.itemPrice,
                  stitchingCharge: item.stitchingCharge,
                  fabricCharge: item.fabricCharge,
                  designCharge: item.designCharge,
                  alterationCharge: item.alterationCharge,
                  urgentCharge: item.urgentCharge,
                  otherCharge: item.otherCharge,
                  quantity: item.quantity,
                  totalItemPrice: item.totalItemPrice,
                  status: ProductionStageName.RECEIVED,
                  internalNotes: item.internalNotes,
                  customerNotes: item.customerNotes
                }
              });

              // Critical: Save Immutable Historical Measurement Snapshot
              if (item.measurementSnapshot) {
                await tx.orderItemMeasurement.create({
                  data: {
                    tenantId,
                    orderItemId: orderItem.id,
                    measurementVersionId: item.measurementSnapshot.measurementVersionId || null,
                    templateVersionId: item.measurementSnapshot.templateVersionId || null,
                    valuesSnapshot: item.measurementSnapshot.valuesSnapshot || {},
                    unit: (item.measurementSnapshot.unit as UnitSystem) || UnitSystem.INCHES,
                    notes: item.measurementSnapshot.notes || null
                  }
                });
              }

              // Save Style selections if present
              if (item.styleOptions && Array.isArray(item.styleOptions)) {
                for (const s of item.styleOptions) {
                  await tx.orderItemStyle.create({
                    data: {
                      tenantId,
                      orderItemId: orderItem.id,
                      styleId: s.styleId,
                      selectedOptions: s.selectedOptions || {}
                    }
                  });
                }
              }

              // Create Production Job for item
              await tx.productionJob.create({
                data: {
                  tenantId,
                  orderItemId: orderItem.id,
                  currentStage: ProductionStageName.RECEIVED,
                  notes: 'Order received into workshop'
                }
              });
            }

            // Record Advance Payment if provided
            if (advance > 0) {
              const p = await tx.payment.create({
                data: {
                  tenantId,
                  orderId: order.id,
                  customerId,
                  amount: advance,
                  paymentMethod: (advancePayment.paymentMethod as PaymentMethod) || PaymentMethod.CASH,
                  referenceNumber: advancePayment.referenceNumber || null,
                  recordedById: req.user?.id || null,
                  notes: 'Advance payment recorded at order creation'
                }
              });

              // Generate Receipt
              const receiptNumber = await PaymentCalculationService.generateReceiptNumber(tx, tenantId);
              await tx.receipt.create({
                data: {
                  tenantId,
                  paymentId: p.id,
                  receiptNumber,
                  amount: advance
                }
              });
            }

            // Audit Log
            await tx.auditLog.create({
              data: {
                tenantId,
                userId: req.user?.id,
                customerId,
                action: 'ORDER_CREATED',
                entity: 'Order',
                entityId: order.id,
                details: { orderNumber: order.orderNumber, total: order.totalAmount, net: order.netAmount, paid: order.paidAmount }
              }
            });

            return order;
          });
        } catch (err: any) {
          if (err.code === 'P2002' && attempts < 5) {
            continue; // Unique constraint race on orderNumber or receiptNumber, retry
          }
          throw err;
        }
      }

      // Send event notification
      await notificationService.send({
        tenantId,
        customerId: customer.id,
        eventType: 'ORDER_RECEIVED',
        recipient: customer.mobile,
        channel: NotificationChannel.SMS,
        title: 'Order Confirmed',
        message: `Dear ${customer.firstName}, your order ${createdOrder.orderNumber} for ₹${createdOrder.netAmount} has been received. Expected delivery: ${new Date(deliveryDate).toLocaleDateString()}.`
      }).catch(e => console.error('Notification failed', e));

      return res.status(201).json({ success: true, data: createdOrder });
    } catch (err) { next(err); }
  }

  // Update Order Status (with delay reason enforcement and audit log)
  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, delayReason, revisedDeliveryDate } = req.body;
      const tenantId = req.tenantId!;

      if (!status || !Object.values(OrderStatus).includes(status)) {
        return res.status(400).json({
          success: false,
          error: { message: `Invalid status. Valid values: ${Object.values(OrderStatus).join(', ')}`, code: 'INVALID_STATUS' }
        });
      }

      const existing = await prisma.order.findFirst({
        where: { id, tenantId },
        include: { customer: true }
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: { message: 'Order not found or access denied.', code: 'ORDER_NOT_FOUND' }
        });
      }

      // Enforce delay rule if revisedDeliveryDate is provided
      if (revisedDeliveryDate) {
        if (!delayReason || !delayReason.trim()) {
          return res.status(400).json({
            success: false,
            error: { message: 'Delay reason is mandatory when revising delivery date.', code: 'MISSING_DELAY_REASON' }
          });
        }
      }

      const updateData: any = {
        status: status as OrderStatus
      };

      if (revisedDeliveryDate) {
        updateData.revisedDeliveryDate = new Date(revisedDeliveryDate);
        updateData.delayReason = delayReason.trim();
      } else if (delayReason) {
        updateData.delayReason = delayReason.trim();
      }

      if (status === OrderStatus.CANCELLED) {
        updateData.isCancelled = true;
        if (req.body.cancellationReason) {
          updateData.cancellationReason = req.body.cancellationReason;
        }
      }

      const updated = await prisma.order.update({
        where: { id },
        data: updateData,
        include: { customer: true, items: { include: { garmentType: true } }, payments: true }
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: req.user?.id,
          customerId: existing.customerId,
          action: 'ORDER_STATUS_UPDATED',
          entity: 'Order',
          entityId: existing.id,
          details: {
            previousStatus: existing.status,
            newStatus: status,
            delayReason: updateData.delayReason || null,
            revisedDeliveryDate: updateData.revisedDeliveryDate || null
          }
        }
      });

      // Send notification on milestone statuses
      if (status === OrderStatus.READY_FOR_PICKUP || status === OrderStatus.DELIVERED) {
        await notificationService.send({
          tenantId,
          customerId: existing.customerId,
          eventType: status === OrderStatus.READY_FOR_PICKUP ? 'ORDER_READY' : 'ORDER_DELIVERED',
          recipient: existing.customer.mobile,
          channel: NotificationChannel.SMS,
          title: status === OrderStatus.READY_FOR_PICKUP ? 'Order Ready for Pickup' : 'Order Delivered',
          message: `Dear ${existing.customer.firstName}, your order ${existing.orderNumber} is ${status === OrderStatus.READY_FOR_PICKUP ? 'ready for pickup at our boutique.' : 'delivered. Thank you!'}`
        }).catch(e => console.error('Notification failed', e));
      }

      return res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  }

  // Update Order (delivery date, revised date, priority, notes)
  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const { deliveryDate, revisedDeliveryDate, delayReason, priority, internalNotes, customerNotes } = req.body;

      const existing = await prisma.order.findFirst({
        where: { id, tenantId }
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: { message: 'Order not found or access denied.', code: 'ORDER_NOT_FOUND' }
        });
      }

      if (revisedDeliveryDate && (!delayReason || !delayReason.trim())) {
        return res.status(400).json({
          success: false,
          error: { message: 'Delay reason is mandatory when revising delivery date.', code: 'MISSING_DELAY_REASON' }
        });
      }

      const updateData: any = {};
      if (deliveryDate) updateData.deliveryDate = new Date(deliveryDate);
      if (revisedDeliveryDate) updateData.revisedDeliveryDate = new Date(revisedDeliveryDate);
      if (delayReason !== undefined) updateData.delayReason = delayReason ? delayReason.trim() : null;
      if (priority !== undefined) updateData.priority = priority;
      if (internalNotes !== undefined) updateData.internalNotes = internalNotes;
      if (customerNotes !== undefined) updateData.customerNotes = customerNotes;

      const updated = await prisma.order.update({
        where: { id },
        data: updateData,
        include: { customer: true, items: { include: { garmentType: true } } }
      });

      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: req.user?.id,
          customerId: existing.customerId,
          action: 'ORDER_UPDATED',
          entity: 'Order',
          entityId: existing.id,
          details: updateData
        }
      });

      return res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  }
}

