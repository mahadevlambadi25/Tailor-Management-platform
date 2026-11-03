import { Request, Response, NextFunction } from 'express';
import { logger } from '../../core/logger';
import { config } from '../../config';
import {
  verifyMetaSignature,
  extractMetaStatusEvents,
  WebhookService,
  WebhookProcessingResult
} from './webhookService';

export class WebhookController {
  /**
   * GET /api/v1/conversion/webhooks/whatsapp
   * Meta Webhook Subscription Verification Challenge.
   */
  static handleVerification(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expectedToken = (config as any).whatsappVerifyToken || process.env.WHATSAPP_VERIFY_TOKEN || 'tailor_whatsapp_verify_token_default';

    if (mode === 'subscribe' && token === expectedToken) {
      logger.info('[WebhookController] Meta webhook subscription challenge verified successfully.');
      return res.status(200).send(challenge);
    }

    logger.warn('[WebhookController] Meta webhook challenge verification failed (token mismatch or invalid mode).');
    return res.status(403).json({ error: 'Verification failed' });
  }

  /**
   * POST /api/v1/conversion/webhooks/whatsapp
   * Receives and processes Meta WhatsApp Business webhook payloads.
   */
  static async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = req.headers['x-hub-signature-256'] as string;
      const secret = (config as any).whatsappAppSecret || process.env.WHATSAPP_APP_SECRET || 'tailor_whatsapp_app_secret_placeholder';

      // 1. Raw body verification
      const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body), 'utf8');

      if (!verifyMetaSignature(rawBody, signature, secret)) {
        logger.warn('[WebhookController] Invalid or missing x-hub-signature-256 signature header');
        return res.status(401).json({
          success: false,
          error: { message: 'Unauthorized: Invalid webhook signature', code: 'INVALID_SIGNATURE' }
        });
      }

      // 2. Extract normalized status events
      const statusEvents = extractMetaStatusEvents(req.body);

      const results: WebhookProcessingResult[] = [];
      for (const event of statusEvents) {
        const result = await WebhookService.processStatusEvent(event);
        results.push(result);
      }

      logger.info(`[WebhookController] Processed ${statusEvents.length} webhook event(s)`);

      return res.status(200).json({
        success: true,
        processedCount: statusEvents.length,
        results
      });
    } catch (err: any) {
      logger.error(`[WebhookController] Error processing webhook: ${err?.message}`, err);
      // Even on internal errors, return 200 or 500 depending on protocol
      return res.status(500).json({
        success: false,
        error: { message: err?.message || 'Internal server error processing webhook' }
      });
    }
  }
}
