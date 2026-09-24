import crypto from 'crypto';
import { config } from '../../config';
import { logger } from '../../core/logger';

export interface CreateRazorpayOrderOptions {
  amountInPaise: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResult {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status: string;
  createdAt: number;
}

export class RazorpayService {
  /**
   * Creates a Razorpay payment order.
   * If real credentials are provided (RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET),
   * calls the official Razorpay REST API (https://api.razorpay.com/v1/orders).
   * In testing/local development with placeholder keys, returns a standard
   * mock order structure without requiring live network or real secrets.
   */
  static async createOrder(options: CreateRazorpayOrderOptions): Promise<RazorpayOrderResult> {
    const keyId = config.razorpayKeyId;
    const keySecret = config.razorpayKeySecret;

    const hasLiveKeys =
      keyId &&
      keySecret &&
      !keyId.includes('placeholder') &&
      !keySecret.includes('placeholder') &&
      keyId.startsWith('rzp_');

    if (hasLiveKeys) {
      try {
        const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const response = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${auth}`
          },
          body: JSON.stringify({
            amount: options.amountInPaise,
            currency: options.currency,
            receipt: options.receipt,
            notes: options.notes
          })
        });

        if (!response.ok) {
          const errBody: any = await response.json().catch(() => ({}));
          const desc = errBody?.error?.description || `Razorpay order creation failed with HTTP ${response.status}`;
          logger.error(`[RazorpayService] API error: ${desc}`, errBody);
          throw new Error(desc);
        }

        const data: any = await response.json();
        return {
          id: data.id,
          amount: data.amount,
          currency: data.currency,
          receipt: data.receipt,
          status: data.status,
          createdAt: data.created_at || Math.floor(Date.now() / 1000)
        };
      } catch (err: any) {
        logger.error(`[RazorpayService] Error connecting to Razorpay: ${err.message}`);
        throw err;
      }
    }

    // Development / Test fixture fallback:
    // Generates an order ID matching Razorpay's standard format (order_xxxxxxxxxxxxxx)
    const randomHex = Math.random().toString(36).substring(2, 16);
    const mockOrderId = `order_${randomHex}`;

    logger.info(`[RazorpayService] Mock order created: ${mockOrderId} for ₹${options.amountInPaise / 100}`);

    return {
      id: mockOrderId,
      amount: options.amountInPaise,
      currency: options.currency,
      receipt: options.receipt,
      status: 'created',
      createdAt: Math.floor(Date.now() / 1000)
    };
  }

  /**
   * Generates HMAC-SHA256 signature for Razorpay checkout payment verification.
   * Format: HMAC_SHA256(order_id + "|" + payment_id, keySecret)
   */
  static generatePaymentSignature(orderId: string, paymentId: string, secret?: string): string {
    const keySecret = secret || config.razorpayKeySecret || 'placeholder_secret';
    return crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
  }

  /**
   * Verifies the Razorpay payment signature returned by frontend checkout on the SERVER.
   * Never trusts the frontend without cryptographic HMAC validation.
   */
  static verifyPaymentSignature(params: {
    orderId: string;
    paymentId: string;
    signature: string;
    secret?: string;
  }): boolean {
    const { orderId, paymentId, signature } = params;
    if (!orderId || !paymentId || !signature) return false;

    const keySecret = params.secret || config.razorpayKeySecret || 'placeholder_secret';
    const expected = this.generatePaymentSignature(orderId, paymentId, keySecret);

    try {
      const expectedBuf = Buffer.from(expected);
      const sigBuf = Buffer.from(signature);
      if (expectedBuf.length !== sigBuf.length) return false;
      return crypto.timingSafeEqual(expectedBuf, sigBuf);
    } catch {
      return false;
    }
  }

  /**
   * Generates HMAC-SHA256 signature for Razorpay webhook verification.
   */
  static generateWebhookSignature(payload: string | Buffer, secret?: string): string {
    const webhookSecret = secret || config.razorpayWebhookSecret || config.razorpayKeySecret || 'placeholder_secret';
    return crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Cryptographically verifies the Razorpay webhook signature from x-razorpay-signature header.
   */
  static verifyWebhookSignature(payload: string | Buffer, signature: string, secret?: string): boolean {
    if (!payload || !signature) return false;

    const webhookSecret = secret || config.razorpayWebhookSecret || config.razorpayKeySecret || 'placeholder_secret';
    const expected = this.generateWebhookSignature(payload, webhookSecret);

    try {
      const expectedBuf = Buffer.from(expected);
      const sigBuf = Buffer.from(signature);
      if (expectedBuf.length !== sigBuf.length) return false;
      return crypto.timingSafeEqual(expectedBuf, sigBuf);
    } catch {
      return false;
    }
  }
}

