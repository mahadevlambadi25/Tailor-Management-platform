import { PaymentMethod, PaymentStatus } from '@prisma/client';

export interface BillingSummary {
  grossAmount: number;
  discountAmount: number;
  gstAmount: number;
  finalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: PaymentStatus;
}

export interface PaymentValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
}

export class PaymentCalculationService {
  /**
   * Helper to round monetary amounts to exactly 2 decimal places, preventing floating-point errors.
   */
  static round2(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  /**
   * Centralized Single Source of Truth for Order Billing & Ledger Calculation.
   * Final Amount = (Gross Amount - Discount) + GST
   * Paid Amount = Total Successful Payments - Total Refunds/Reversals
   * Balance Due = Final Amount - Paid Amount
   */
  static calculateOrderBilling(
    netAmount: number,
    payments: Array<{ amount: any; isRefund?: boolean; isCorrection?: boolean }>
  ): { paidAmount: number; balanceAmount: number; paymentStatus: PaymentStatus } {
    const finalAmount = this.round2(Number(netAmount));

    const totalPaid = payments.reduce((sum, p) => {
      const pAmt = this.round2(Number(p.amount));
      return p.isRefund ? this.round2(sum - pAmt) : this.round2(sum + pAmt);
    }, 0);

    const safePaid = Math.max(0, this.round2(totalPaid));
    const balanceAmount = Math.max(0, this.round2(finalAmount - safePaid));

    let paymentStatus: PaymentStatus = PaymentStatus.UNPAID;
    if (safePaid >= finalAmount && finalAmount > 0) {
      paymentStatus = PaymentStatus.PAID;
    } else if (safePaid > 0) {
      paymentStatus = PaymentStatus.PARTIAL;
    }

    return {
      paidAmount: safePaid,
      balanceAmount,
      paymentStatus
    };
  }

  /**
   * Enforces business rules for recording payments:
   * 1. Amount must be strictly greater than 0.
   * 2. Amount cannot exceed remaining balance.
   * 3. Payment method must be one of CASH, UPI, CARD, BANK_TRANSFER, OTHER.
   */
  static validatePaymentInput(
    order: { netAmount: any; paidAmount: any; balanceAmount: any },
    amount: number,
    paymentMethod: string
  ): PaymentValidationResult {
    const payAmount = Number(amount);

    if (isNaN(payAmount) || payAmount <= 0) {
      return {
        valid: false,
        error: 'Payment amount must be greater than 0.',
        code: 'INVALID_AMOUNT'
      };
    }

    const currentBalance = this.round2(Number(order.balanceAmount));
    if (this.round2(payAmount) > currentBalance) {
      return {
        valid: false,
        error: 'Payment amount cannot exceed the remaining balance.',
        code: 'EXCEEDS_BALANCE'
      };
    }

    const validMethods: PaymentMethod[] = [
      PaymentMethod.CASH,
      PaymentMethod.UPI,
      PaymentMethod.CARD,
      PaymentMethod.BANK_TRANSFER,
      PaymentMethod.OTHER
    ];

    if (!validMethods.includes(paymentMethod as PaymentMethod)) {
      return {
        valid: false,
        error: `Invalid payment method. Allowed methods: ${validMethods.join(', ')}.`,
        code: 'INVALID_PAYMENT_METHOD'
      };
    }

    return { valid: true };
  }

  /**
   * Generates a collision-safe sequential receipt number for a tenant
   */
  static async generateReceiptNumber(tx: any, tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const receiptCount = await tx.receipt.count({ where: { tenantId } });
    let seq = 1001 + receiptCount;
    let receiptNumber = `REC-${year}-${seq}`;

    // Concurrency collision-check
    let existing = await tx.receipt.findFirst({
      where: { tenantId, receiptNumber }
    });
    while (existing) {
      seq++;
      receiptNumber = `REC-${year}-${seq}`;
      existing = await tx.receipt.findFirst({
        where: { tenantId, receiptNumber }
      });
    }

    return receiptNumber;
  }
}

