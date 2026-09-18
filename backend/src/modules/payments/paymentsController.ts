import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../core/prisma';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

export class PaymentsController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId, customerId, page, limit } = req.query;
      const tenantId = req.tenantId!;

      const whereClause = {
        tenantId,
        orderId: orderId ? (orderId as string) : undefined,
        customerId: customerId ? (customerId as string) : undefined
      };

      const limitNum = limit ? parseInt(limit as string, 10) : 50;
      const pageNum = page ? parseInt(page as string, 10) : 1;
      const skip = (pageNum - 1) * limitNum;

      const [total, payments] = await Promise.all([
        prisma.payment.count({ where: whereClause }),
        prisma.payment.findMany({
          where: whereClause,
          include: {
            order: { select: { orderNumber: true, netAmount: true, balanceAmount: true } },
            customer: { select: { firstName: true, lastName: true, mobile: true } },
            receipts: true
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum
        })
      ]);

      return res.json({
        success: true,
        data: payments,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (err) { next(err); }
  }

  static async recordPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { orderId, amount, paymentMethod = 'CASH', referenceNumber, notes, isRefund = false, isCorrection = false } = req.body;

      if (!orderId || !amount) {
        return res.status(400).json({ success: false, error: { message: 'Missing orderId or amount' } });
      }

      const order = await prisma.order.findFirst({
        where: { id: orderId, tenantId },
        include: { customer: true }
      });

      if (!order) {
        return res.status(404).json({ success: false, error: { message: 'Order not found' } });
      }

      const payAmount = Number(amount);

      const result = await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            tenantId,
            orderId,
            customerId: order.customerId,
            amount: payAmount,
            paymentMethod: paymentMethod as PaymentMethod,
            referenceNumber,
            recordedById: req.user?.id,
            notes,
            isRefund,
            isCorrection
          }
        });

        // Recalculate order payments
        const allPayments = await tx.payment.findMany({
          where: { orderId, tenantId }
        });

        const totalPaid = allPayments.reduce((sum, p) => {
          return p.isRefund ? sum - Number(p.amount) : sum + Number(p.amount);
        }, 0);

        const newBalance = Number(order.netAmount) - totalPaid;
        let newStatus: PaymentStatus = PaymentStatus.UNPAID;
        if (totalPaid >= Number(order.netAmount)) {
          newStatus = totalPaid > Number(order.netAmount) ? PaymentStatus.OVERPAID : PaymentStatus.PAID;
        } else if (totalPaid > 0) {
          newStatus = PaymentStatus.PARTIAL;
        }

        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            paidAmount: totalPaid,
            balanceAmount: newBalance,
            paymentStatus: newStatus
          }
        });

        // Create Receipt
        const receiptCount = await tx.receipt.count({ where: { tenantId } });
        const receipt = await tx.receipt.create({
          data: {
            tenantId,
            paymentId: payment.id,
            receiptNumber: `REC-${new Date().getFullYear()}-${(1001 + receiptCount).toString()}`,
            amount: payAmount
          }
        });

        await tx.auditLog.create({
          data: {
            tenantId,
            userId: req.user?.id,
            customerId: order.customerId,
            action: isRefund ? 'PAYMENT_REFUNDED' : 'PAYMENT_RECORDED',
            entity: 'Payment',
            entityId: payment.id,
            details: { amount: payAmount, paymentMethod, newBalance }
          }
        });

        return { payment, receipt, updatedOrder };
      });

      return res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  }
}
