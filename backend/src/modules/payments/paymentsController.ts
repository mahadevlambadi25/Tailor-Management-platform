import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/prisma';
import { PaymentMethod, PaymentStatus, RoleType } from '@prisma/client';
import { PaymentCalculationService } from './paymentCalculationService';

export class PaymentsController {
  /**
   * List payments with search, method, orderId, and customerId filtering
   */
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId, customerId, paymentMethod, search, page, limit } = req.query;
      const tenantId = req.tenantId!;

      const whereClause: any = { tenantId };

      if (orderId && typeof orderId === 'string') {
        whereClause.orderId = orderId;
      }

      if (customerId && typeof customerId === 'string') {
        whereClause.customerId = customerId;
      }

      if (paymentMethod && typeof paymentMethod === 'string') {
        whereClause.paymentMethod = paymentMethod as PaymentMethod;
      }

      if (search && typeof search === 'string' && search.trim()) {
        const query = search.trim();
        whereClause.OR = [
          { referenceNumber: { contains: query, mode: 'insensitive' } },
          { order: { orderNumber: { contains: query, mode: 'insensitive' } } },
          { customer: { firstName: { contains: query, mode: 'insensitive' } } },
          { customer: { lastName: { contains: query, mode: 'insensitive' } } },
          { customer: { mobile: { contains: query } } },
          { receipts: { some: { receiptNumber: { contains: query, mode: 'insensitive' } } } }
        ];
      }

      const limitNum = limit ? parseInt(limit as string, 10) : 50;
      const pageNum = page ? parseInt(page as string, 10) : 1;
      const skip = (pageNum - 1) * limitNum;

      const [total, payments] = await Promise.all([
        prisma.payment.count({ where: whereClause }),
        prisma.payment.findMany({
          where: whereClause,
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                totalAmount: true,
                discountAmount: true,
                gstAmount: true,
                netAmount: true,
                paidAmount: true,
                balanceAmount: true,
                paymentStatus: true
              }
            },
            customer: {
              select: {
                id: true,
                customerId: true,
                firstName: true,
                lastName: true,
                mobile: true,
                email: true
              }
            },
            receipts: true
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum
        })
      ]);

      // Enrich with staff names for recordedById
      const staffIds = payments.map((p) => p.recordedById).filter(Boolean) as string[];
      const staffMembers = await prisma.user.findMany({
        where: { id: { in: staffIds }, tenantId },
        select: { id: true, name: true, role: true }
      });
      const staffMap = new Map(staffMembers.map((s) => [s.id, s]));

      const enrichedPayments = payments.map((p) => ({
        ...p,
        recordedBy: p.recordedById ? staffMap.get(p.recordedById) || null : null
      }));

      return res.json({
        success: true,
        data: enrichedPayments,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get single payment details with receipts, order, and customer
   */
  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;

      const payment = await prisma.payment.findFirst({
        where: { id, tenantId },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              discountAmount: true,
              gstAmount: true,
              netAmount: true,
              paidAmount: true,
              balanceAmount: true,
              paymentStatus: true
            }
          },
          customer: {
            select: {
              id: true,
              customerId: true,
              firstName: true,
              lastName: true,
              mobile: true,
              email: true,
              address: true,
              city: true
            }
          },
          receipts: true
        }
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: { message: 'Payment record not found', code: 'PAYMENT_NOT_FOUND' }
        });
      }

      let recordedBy = null;
      if (payment.recordedById) {
        recordedBy = await prisma.user.findFirst({
          where: { id: payment.recordedById, tenantId },
          select: { id: true, name: true, role: true }
        });
      }

      return res.json({
        success: true,
        data: {
          ...payment,
          recordedBy
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Record a manual payment against an order
   */
  static async recordPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const {
        orderId,
        amount,
        paymentMethod = 'CASH',
        referenceNumber,
        notes,
        paymentDate
      } = req.body;

      if (!orderId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Missing orderId', code: 'MISSING_ORDER_ID' }
        });
      }

      // Verify order exists and strictly belongs to current tenant
      const order = await prisma.order.findFirst({
        where: { id: orderId, tenantId },
        include: { customer: true }
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          error: { message: 'Order not found in this shop', code: 'ORDER_NOT_FOUND' }
        });
      }

      // Strict Validation: Amount > 0, Amount <= Remaining Balance, Payment Method
      const validation = PaymentCalculationService.validatePaymentInput(
        order,
        amount,
        paymentMethod
      );
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: { message: validation.error, code: validation.code }
        });
      }

      const payAmount = PaymentCalculationService.round2(Number(amount));

      const result = await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            tenantId,
            orderId,
            customerId: order.customerId,
            amount: payAmount,
            paymentMethod: paymentMethod as PaymentMethod,
            referenceNumber: referenceNumber ? referenceNumber.trim() : null,
            recordedById: req.user?.id || null,
            notes: notes ? notes.trim() : null,
            createdAt: paymentDate ? new Date(paymentDate) : new Date(),
            isRefund: false,
            isCorrection: false
          }
        });

        // Recalculate order payments with single source of truth
        const allPayments = await tx.payment.findMany({
          where: { orderId, tenantId }
        });

        const billing = PaymentCalculationService.calculateOrderBilling(
          Number(order.netAmount),
          allPayments
        );

        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            paidAmount: billing.paidAmount,
            balanceAmount: billing.balanceAmount,
            paymentStatus: billing.paymentStatus
          }
        });

        // Generate sequential collision-safe receipt
        const receiptNumber = await PaymentCalculationService.generateReceiptNumber(tx, tenantId);
        const receipt = await tx.receipt.create({
          data: {
            tenantId,
            paymentId: payment.id,
            receiptNumber,
            amount: payAmount
          }
        });

        // Audit Trail
        await tx.auditLog.create({
          data: {
            tenantId,
            userId: req.user?.id,
            customerId: order.customerId,
            action: 'PAYMENT_RECORDED',
            entity: 'Payment',
            entityId: payment.id,
            details: {
              orderId,
              orderNumber: order.orderNumber,
              paymentId: payment.id,
              receiptNumber: receipt.receiptNumber,
              amount: payAmount,
              paymentMethod,
              referenceNumber: referenceNumber || null,
              previousBalance: Number(order.balanceAmount),
              newBalance: billing.balanceAmount,
              paymentStatus: billing.paymentStatus,
              recordedById: req.user?.id,
              recordedByName: req.user?.name
            }
          }
        });

        return {
          ...payment,
          payment,
          receipt,
          receipts: receipt ? [receipt] : [],
          updatedOrder
        };
      });

      return res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Helper alias for POST /orders/:orderId/payments
   */
  static async recordOrderPayment(req: Request, res: Response, next: NextFunction) {
    req.body.orderId = req.params.orderId;
    return PaymentsController.recordPayment(req, res, next);
  }

  /**
   * Get payments for a specific order with complete billing summary
   */
  static async getOrderPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId } = req.params;
      const tenantId = req.tenantId!;

      const order = await prisma.order.findFirst({
        where: { id: orderId, tenantId },
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, mobile: true } }
        }
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          error: { message: 'Order not found', code: 'ORDER_NOT_FOUND' }
        });
      }

      const payments = await prisma.payment.findMany({
        where: { orderId, tenantId },
        include: { receipts: true },
        orderBy: { createdAt: 'desc' }
      });

      // Enrich with staff names
      const staffIds = payments.map((p) => p.recordedById).filter(Boolean) as string[];
      const staffMembers = await prisma.user.findMany({
        where: { id: { in: staffIds }, tenantId },
        select: { id: true, name: true, role: true }
      });
      const staffMap = new Map(staffMembers.map((s) => [s.id, s]));

      const enrichedPayments = payments.map((p) => ({
        ...p,
        recordedBy: p.recordedById ? staffMap.get(p.recordedById) || null : null
      }));

      const billing = PaymentCalculationService.calculateOrderBilling(
        Number(order.netAmount),
        payments
      );

      const billingSummary = {
        grossAmount: Number(order.totalAmount),
        discountAmount: Number(order.discountAmount),
        gstAmount: Number(order.gstAmount),
        netAmount: Number(order.netAmount),
        finalAmount: Number(order.netAmount),
        paidAmount: billing.paidAmount,
        balanceAmount: billing.balanceAmount,
        paymentStatus: billing.paymentStatus
      };

      return res.json({
        success: true,
        data: {
          order: {
            id: order.id,
            orderNumber: order.orderNumber,
            customer: order.customer,
            ...billingSummary
          },
          billingSummary,
          payments: enrichedPayments
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Cancel / Reverse a recorded payment with mandatory audit reason (Restricted to SHOP_OWNER and MANAGER)
   */
  static async cancelPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const tenantId = req.tenantId!;

      if (!reason || !reason.trim()) {
        return res.status(400).json({
          success: false,
          error: { message: 'A reason is mandatory when cancelling a payment record', code: 'MISSING_CANCEL_REASON' }
        });
      }

      const existingPayment = await prisma.payment.findFirst({
        where: { id, tenantId },
        include: { order: true }
      });

      if (!existingPayment) {
        return res.status(404).json({
          success: false,
          error: { message: 'Payment record not found', code: 'PAYMENT_NOT_FOUND' }
        });
      }

      if (existingPayment.isRefund) {
        return res.status(400).json({
          success: false,
          error: { message: 'Cannot cancel a payment reversal entry', code: 'CANNOT_CANCEL_REVERSAL' }
        });
      }

      if (existingPayment.isCorrection) {
        return res.status(400).json({
          success: false,
          error: { message: 'This payment has already been cancelled or corrected', code: 'ALREADY_CANCELLED' }
        });
      }

      const reversalAmount = PaymentCalculationService.round2(Number(existingPayment.amount));

      const result = await prisma.$transaction(async (tx) => {
        // Mark original payment as corrected
        await tx.payment.update({
          where: { id },
          data: {
            isCorrection: true,
            notes: `[CANCELLED: ${reason.trim()}] ${existingPayment.notes || ''}`
          }
        });

        // Record offsetting double-entry reversal
        const reversal = await tx.payment.create({
          data: {
            tenantId,
            orderId: existingPayment.orderId,
            customerId: existingPayment.customerId,
            amount: reversalAmount,
            paymentMethod: existingPayment.paymentMethod,
            referenceNumber: existingPayment.referenceNumber
              ? `REV-${existingPayment.referenceNumber}`
              : null,
            recordedById: req.user?.id || null,
            notes: `[REVERSAL] Cancellation of payment #${existingPayment.id}: ${reason.trim()}`,
            isRefund: true,
            isCorrection: true
          }
        });

        // Recalculate order payments
        const allPayments = await tx.payment.findMany({
          where: { orderId: existingPayment.orderId, tenantId }
        });

        const billing = PaymentCalculationService.calculateOrderBilling(
          Number(existingPayment.order.netAmount),
          allPayments
        );

        const updatedOrder = await tx.order.update({
          where: { id: existingPayment.orderId },
          data: {
            paidAmount: billing.paidAmount,
            balanceAmount: billing.balanceAmount,
            paymentStatus: billing.paymentStatus
          }
        });

        // Audit Trail
        await tx.auditLog.create({
          data: {
            tenantId,
            userId: req.user?.id,
            customerId: existingPayment.customerId,
            action: 'PAYMENT_CANCELLED',
            entity: 'Payment',
            entityId: existingPayment.id,
            details: {
              orderId: existingPayment.orderId,
              orderNumber: existingPayment.order.orderNumber,
              originalPaymentId: existingPayment.id,
              reversalPaymentId: reversal.id,
              amount: reversalAmount,
              cancellationReason: reason.trim(),
              cancelledById: req.user?.id,
              cancelledByName: req.user?.name,
              newBalance: billing.balanceAmount,
              paymentStatus: billing.paymentStatus
            }
          }
        });

        return {
          cancelledPaymentId: existingPayment.id,
          reversal,
          updatedOrder
        };
      });

      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
