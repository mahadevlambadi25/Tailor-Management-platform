import { NotificationChannel } from '@prisma/client';
import { logger } from '../../core/logger';

export interface ProviderDispatchPayload {
  outboxId: string;
  to: string;
  channel: NotificationChannel;
  templateKey: string;
  renderedContent: string;
  vars?: Record<string, any>;
  idempotencyKey?: string;
  nudgeLogId?: string;
}

export interface ProviderDispatchResult {
  outcome: 'ACCEPTED' | 'STUBBED' | 'FAILED';
  providerMessageId?: string;
  isRetryable: boolean;
  error?: string;
}

export interface IMessagingProvider {
  dispatch(payload: ProviderDispatchPayload): Promise<ProviderDispatchResult>;
}

/**
 * Stub WhatsApp Provider
 * - STRICT GUARANTEE: Never makes external cellular, carrier, or WhatsApp API network calls.
 * - Never fabricates true delivery; never returns ACCEPTED or DELIVERED.
 * - Always returns outcome: 'STUBBED' so the outbox worker transitions
 *   OutboxMessage to STUBBED and NudgeLog to SIMULATED.
 */
export class StubWhatsAppProvider implements IMessagingProvider {
  async dispatch(payload: ProviderDispatchPayload): Promise<ProviderDispatchResult> {
    logger.info(
      `[StubWhatsAppProvider] Simulated dispatch for outbox ${payload.outboxId} (${payload.templateKey}) to ${payload.to}`
    );

    const safeKey = payload.idempotencyKey || payload.outboxId;
    const providerMessageId = `stub_msg_${safeKey}`;

    return {
      outcome: 'STUBBED',
      providerMessageId,
      isRetryable: false
    };
  }
}

/**
 * Provider Registry
 * Resolves messaging provider based on channel and environment configuration.
 */
export function getMessagingProvider(channel: NotificationChannel = NotificationChannel.WHATSAPP): IMessagingProvider {
  switch (channel) {
    case NotificationChannel.WHATSAPP:
    case NotificationChannel.SMS:
    case NotificationChannel.EMAIL:
    case NotificationChannel.IN_APP:
    default:
      return new StubWhatsAppProvider();
  }
}
