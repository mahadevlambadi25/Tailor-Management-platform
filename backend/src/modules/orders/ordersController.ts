import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/prisma';
import { notificationService } from '../notifications/notificationService';
import { NotificationChannel, OrderStatus, PaymentMethod, PaymentStatus, ProductionStageName, RoleType, UnitSystem } from '@prisma/client';

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
        whereClause.deliveryDate = {
          gte: new Date(d.setHours(0, 0, 0, 0)),
          lte: new Date(d.setHours(23, 59, 59, 999))
        };
      }
      if (search) {
        const q = (search as string).trim();
        whereClause.OR = [
          { orderNumber: { contains: q, mode: 'insensitive' } },
          { customer: { firstName: { contains: q, mode: 'insensitive' } } },
          { customer: { lastName: { contains: q, mode: 'insensitive' } } },
          { customer: { mobile: { contains: q } } }
        ];
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

  // Get Order By ID
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
          payments: { orderBy: { createdAt: 'desc' } },
          invoices: true
        }
      });

      if (!order) {
        return res.status(404).json({ success: false, error: { message: 'Order not found' } });
      }

      return res.json({ success: true, data: order });
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
          error: { message: 'Missing required order fields (customerId, deliveryDate, or items array)' }
        });
      }

      // Verify customer exists in tenant
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, tenantId, isDeleted: false }
      });
      if (!customer) {
        return res.status(404).json({ success: false, error: { message: 'Customer not found' } });
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
          measurementSnapshot: item.measurementSnapshot, // { valuesSnapshot, unit, measurementVersionId, templateVersionId }
          styleOptions: item.styleOptions // [{ styleId, selectedOptions }]
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

              // Critical: Save Immutable Historical Measurement Snapshot!
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
              await tx.receipt.create({
                data: {
                  tenantId,
                  paymentId: p.id,
                  receiptNumber: `REC-${year}-${candidateSeq.toString()}`,
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
            continue; // Unique constraint race on orderNumber or receiptNumber, retry with next candidate
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
      });

      return res.status(201).json({ success: true, data: createdOrder });
    } catch (err) { next(err); }
  }
}
