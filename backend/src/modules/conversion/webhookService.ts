import crypto from 'crypto';
import { prisma } from '../../core/prisma';
import { logger } from '../../core/logger';
import { config } from '../../config';

export interface NormalizedStatusEvent {
  provider: 'whatsapp_meta';
  phoneNumberId: string;
  providerMessageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipientId?: string;
  errors?: Array<{ code: number; title?: string; message?: string }>;
  rawPayload: any;
}

export interface WebhookProcessingResult {
  outcome: 'APPLIED' | 'DUPLICATE' | 'UNMATCHED' | 'REJECTED_FINAL' | 'REJECTED_STUBBED';
  providerMessageId: string;
  status: string;
  details?: string;
}

/**
 * Validates Meta WhatsApp Webhook HMAC-SHA256 Signature.
 * Strictly verifies hexadecimal format, equal byte lengths, and uses constant-time comparison.
 */
export function verifyMetaSignature(rawBody: Buffer | string, signatureHeader?: string, secret?: string): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'sha256') {
    return false;
  }

  const providedHash = parts[1].trim();

  // 1. Strict regex verification: must be exactly 64 hexadecimal characters (32 bytes)
  if (!/^[0-9a-fA-F]{64}$/.test(providedHash)) {
    return false;
  }

  const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');

  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(bodyBuffer)
    .digest('hex');

  const providedBuffer = Buffer.from(providedHash, 'hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');

  // 2. Strict buffer byte length equality check to prevent RangeError in timingSafeEqual
  if (providedBuffer.length !== expectedBuffer.length || providedBuffer.length !== 32) {
    return false;
  }

  // 3. Constant-time equality comparison
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Extracts normalized status events from a Meta WhatsApp Business webhook body.
 */
export function extractMetaStatusEvents(body: any): NormalizedStatusEvent[] {
  const events: NormalizedStatusEvent[] = [];
  if (body?.object !== 'whatsapp_business_account' || !Array.isArray(body?.entry)) {
    return events;
  }

  for (const entry of body.entry) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue;
      const phoneNumberId = change.value?.metadata?.phone_number_id || 'unknown_node';
      const statuses = change.value?.statuses || [];

      for (const item of statuses) {
        if (!item.id || !item.status || !item.timestamp) continue;
        events.push({
          provider: 'whatsapp_meta',
          phoneNumberId,
          providerMessageId: item.id,
          status: item.status,
          timestamp: String(item.timestamp),
          recipientId: item.recipient_id,
          errors: item.errors,
          rawPayload: item
        });
      }
    }
  }

  return events;
}

/**
 * Computes deterministic, provider-scoped event identifier.
 */
export function computeNormalizedEventId(event: NormalizedStatusEvent): string {
  return `${event.phoneNumberId}:${event.providerMessageId}:${event.status}:${event.timestamp}`;
}

export class WebhookService {
  /**
   * Processes a single normalized status event atomically.
   */
  static async processStatusEvent(
    event: NormalizedStatusEvent,
    client: any = prisma
  ): Promise<WebhookProcessingResult> {
    const eventId = computeNormalizedEventId(event);
    const eventTime = new Date(parseInt(event.timestamp, 10) * 1000);

    return await client.$transaction(async (tx: any) => {
      // 1. Idempotent event persistence (Provider-scoped deduplication)
      const inserted = await tx.$queryRawUnsafe(`
        INSERT INTO webhook_events ("id", "provider", "eventId", "eventType", "payload", "status", "processedAt")
        VALUES (gen_random_uuid()::text, '${event.provider}', '${eventId}', '${event.status}', $1::jsonb, 'PROCESSED', NOW())
        ON CONFLICT ("provider", "eventId") DO NOTHING
        RETURNING "id";
      `, JSON.stringify(event.rawPayload));

      if (!Array.isArray(inserted) || inserted.length === 0) {
        // Event was already processed
        return {
          outcome: 'DUPLICATE',
          providerMessageId: event.providerMessageId,
          status: event.status,
          details: 'Event already recorded in webhook_events'
        };
      }

      // 2. Correlate with OutboxMessage
      const outbox = await tx.outboxMessage.findUnique({
        where: { providerMessageId: event.providerMessageId }
      });

      if (!outbox) {
        // Unmatched message ID (e.g. from test run or race condition before worker DB commit)
        await tx.webhookEvent.update({
          where: { provider_eventId: { provider: event.provider, eventId } },
          data: { status: 'UNMATCHED' }
        });

        logger.warn(`[WebhookService] Unmatched providerMessageId: ${event.providerMessageId} for event ${eventId}`);
        return {
          outcome: 'UNMATCHED',
          providerMessageId: event.providerMessageId,
          status: event.status,
          details: 'providerMessageId not found in outbox_messages'
        };
      }

      // 3. Security Guard: Never allow provider webhooks to modify STUBBED records
      if (outbox.status === 'STUBBED') {
        logger.warn(`[WebhookService] Security Guard: Webhook attempted to mutate STUBBED record ${outbox.id}`);
        await tx.webhookEvent.update({
          where: { provider_eventId: { provider: event.provider, eventId } },
          data: { status: 'REJECTED_STUBBED' }
        });
        return {
          outcome: 'REJECTED_STUBBED',
          providerMessageId: event.providerMessageId,
          status: event.status,
          details: 'OutboxMessage is in immutable STUBBED state'
        };
      }

      // 4. State Transition Processing with Monotonic & Lease Clearing Guarantees
      let outboxUpdated = 0;

      if (event.status === 'delivered' || event.status === 'read') {
        outboxUpdated = await tx.$executeRaw`
          UPDATE outbox_messages
          SET
            status = 'DELIVERED',
            "deliveredAt" = ${eventTime},
            "leaseToken" = NULL,
            "lockedAt" = NULL,
            "lockedBy" = NULL,
            "updatedAt" = NOW()
          WHERE id = ${outbox.id}
            AND status IN ('PENDING', 'PROCESSING', 'ACCEPTED');
        `;
      } else if (event.status === 'failed') {
        const errorMsg = event.errors?.[0]?.message || 'Carrier/provider reported delivery failure';
        outboxUpdated = await tx.$executeRaw`
          UPDATE outbox_messages
          SET
            status = 'FAILED',
            "lastError" = ${errorMsg},
            "leaseToken" = NULL,
            "lockedAt" = NULL,
            "lockedBy" = NULL,
            "updatedAt" = NOW()
          WHERE id = ${outbox.id}
            AND status IN ('PENDING', 'PROCESSING', 'ACCEPTED');
        `;
      } else if (event.status === 'sent') {
        outboxUpdated = await tx.$executeRaw`
          UPDATE outbox_messages
          SET
            status = 'ACCEPTED',
            "updatedAt" = NOW()
          WHERE id = ${outbox.id}
            AND status IN ('PENDING', 'PROCESSING');
        `;
      }

      // 5. Strict Cross-Table Consistency: Update NudgeLog ONLY if OutboxMessage actually transitioned!
      if (outboxUpdated === 1 && outbox.nudgeLogId) {
        if (event.status === 'delivered' || event.status === 'read') {
          await tx.$executeRaw`
            UPDATE nudge_logs
            SET
              status = 'DELIVERED',
              "deliveredAt" = ${eventTime},
              "updatedAt" = NOW()
            WHERE id = ${outbox.nudgeLogId}
              AND status != 'SIMULATED';
          `;
        } else if (event.status === 'failed') {
          const errorMsg = event.errors?.[0]?.message || 'Carrier/provider reported delivery failure';
          await tx.$executeRaw`
            UPDATE nudge_logs
            SET
              status = 'FAILED',
              "error" = ${errorMsg},
              "updatedAt" = NOW()
            WHERE id = ${outbox.nudgeLogId}
              AND status != 'SIMULATED';
          `;
        } else if (event.status === 'sent') {
          await tx.$executeRaw`
            UPDATE nudge_logs
            SET
              status = 'ACCEPTED',
              "updatedAt" = NOW()
            WHERE id = ${outbox.nudgeLogId}
              AND status != 'SIMULATED';
          `;
        }

        return {
          outcome: 'APPLIED',
          providerMessageId: event.providerMessageId,
          status: event.status
        };
      }

      // Outbox was already in a terminal state (DELIVERED or FAILED) or regression was rejected
      return {
        outcome: 'REJECTED_FINAL',
        providerMessageId: event.providerMessageId,
        status: event.status,
        details: 'OutboxMessage already in terminal or superior state'
      };
    });
  }

  /**
   * Reconciles unmatched webhook events against recently committed OutboxMessages.
   * Resolves the race condition where provider webhook arrived before worker commit.
   */
  static async reconcileUnmatchedEvents(client: any = prisma): Promise<number> {
    const unmatched = await client.webhookEvent.findMany({
      where: {
        status: 'UNMATCHED',
        processedAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) }
      },
      take: 50
    });

    let reconciledCount = 0;
    for (const record of unmatched) {
      const parts = record.eventId.split(':');
      const providerMessageId = parts[1];
      if (!providerMessageId) continue;

      const outbox = await client.outboxMessage.findUnique({
        where: { providerMessageId }
      });

      if (outbox) {
        await client.$transaction(async (tx: any) => {
          const eventTime = record.payload?.timestamp
            ? new Date(parseInt(record.payload.timestamp, 10) * 1000)
            : new Date();

          if (record.eventType === 'delivered' || record.eventType === 'read') {
            await tx.$executeRaw`
              UPDATE outbox_messages
              SET
                status = 'DELIVERED',
                "deliveredAt" = ${eventTime},
                "leaseToken" = NULL,
                "lockedAt" = NULL,
                "lockedBy" = NULL,
                "updatedAt" = NOW()
              WHERE id = ${outbox.id}
                AND status IN ('PENDING', 'PROCESSING', 'ACCEPTED');
            `;
            if (outbox.nudgeLogId) {
              await tx.$executeRaw`
                UPDATE nudge_logs
                SET
                  status = 'DELIVERED',
                  "deliveredAt" = ${eventTime},
                  "updatedAt" = NOW()
                WHERE id = ${outbox.nudgeLogId}
                  AND status != 'SIMULATED';
              `;
            }
          }

          await tx.webhookEvent.update({
            where: { id: record.id },
            data: { status: 'PROCESSED' }
          });
        });
        reconciledCount++;
      }
    }

    return reconciledCount;
  }
}
