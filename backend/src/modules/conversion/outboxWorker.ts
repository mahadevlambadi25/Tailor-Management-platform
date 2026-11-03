import crypto from 'crypto';
import { prisma } from '../../core/prisma';
import { logger } from '../../core/logger';
import { getMessagingProvider, IMessagingProvider } from './messagingProvider';

export class StaleLeaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaleLeaseError';
  }
}

export interface OutboxWorkerOptions {
  batchSize?: number;
  leaseDurationSeconds?: number;
  providerTimeoutMs?: number;
  baseBackoffSeconds?: number;
  workerId?: string;
  providerOverride?: IMessagingProvider;
}

export interface ProcessBatchResult {
  claimedCount: number;
  succeededCount: number;
  failedCount: number;
  retriedCount: number;
  staleCount: number;
}

/**
 * Transactional Outbox Worker
 *
 * Distributed Systems Guarantees:
 * 1. Safe Concurrency: Claims rows via `FOR UPDATE SKIP LOCKED`.
 * 2. Per-Row Fencing: Generates a brand new, unique `gen_random_uuid()` leaseToken for each claimed message.
 *    No single token is ever reused across a batch or on reclaims.
 * 3. Split-Brain Protection: Stale workers (whose leases expired during network stalls or event-loop pauses)
 *    are strictly rejected on status updates via `WHERE id = $id AND "leaseToken" = $token AND status = 'PROCESSING'`.
 * 4. Independent Network Calls: No database transaction is held open during external HTTP dispatches.
 *
 * External Provider Limitation Notice:
 * WhatsApp / SMS aggregators operate on an at-least-once distributed delivery boundary.
 * If a worker's 60-second lease expires while an in-flight HTTP request is delayed on the provider's socket,
 * a second worker will reclaim and dispatch the message. Without provider-level idempotency key support,
 * this can result in duplicate message reception on the end-user's device.
 */
export class OutboxWorker {
  private batchSize: number;
  private leaseDurationSeconds: number;
  private providerTimeoutMs: number;
  private baseBackoffSeconds: number;
  private workerId: string;
  private providerOverride?: IMessagingProvider;
  private isRunning: boolean = false;

  constructor(options?: OutboxWorkerOptions) {
    this.batchSize = options?.batchSize || 10;
    this.leaseDurationSeconds = options?.leaseDurationSeconds || 60;
    this.providerTimeoutMs = options?.providerTimeoutMs || 5000;
    this.baseBackoffSeconds = options?.baseBackoffSeconds || 30;
    this.workerId = options?.workerId || `worker_${process.pid}_${crypto.randomUUID().slice(0, 8)}`;
    this.providerOverride = options?.providerOverride;
  }

  /**
   * Claims a batch of PENDING or expired PROCESSING messages.
   * Uses FOR UPDATE SKIP LOCKED and generates an autonomous gen_random_uuid() leaseToken per row.
   */
  async claimBatch(client: any = prisma): Promise<any[]> {
    const rawRows = await client.$queryRawUnsafe(`
      WITH claimable AS (
        SELECT id
        FROM outbox_messages
        WHERE (
          (status = 'PENDING' AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= NOW()))
          OR
          (status = 'PROCESSING' AND "lockedAt" <= NOW() - INTERVAL '${this.leaseDurationSeconds} seconds')
        )
        ORDER BY "createdAt" ASC
        LIMIT ${this.batchSize}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE outbox_messages
      SET
        status = 'PROCESSING',
        "lockedAt" = NOW(),
        "lockedBy" = '${this.workerId}',
        "leaseToken" = gen_random_uuid()::text,
        "updatedAt" = NOW()
      FROM claimable
      WHERE outbox_messages.id = claimable.id
      RETURNING outbox_messages.*;
    `);

    return Array.isArray(rawRows) ? rawRows : [];
  }

  /**
   * Heartbeat to renew lease for a long-running message processing task.
   * Conditional on leaseToken and status = 'PROCESSING'.
   */
  async heartbeat(messageId: string, claimedToken: string, client: any = prisma): Promise<boolean> {
    const res = await client.$executeRaw`
      UPDATE outbox_messages
      SET
        "lockedAt" = NOW(),
        "updatedAt" = NOW()
      WHERE id = ${messageId}
        AND "leaseToken" = ${claimedToken}
        AND status = 'PROCESSING';
    `;
    return res > 0;
  }

  /**
   * Processes a single message outside of an open database transaction.
   */
  async processMessage(message: any, client: any = prisma): Promise<'SUCCEEDED' | 'RETRIED' | 'FAILED' | 'STALE'> {
    const claimedToken = message.leaseToken;
    const provider = this.providerOverride || getMessagingProvider(message.channel);

    // 1. External dispatch outside DB transaction with strict timeout
    let dispatchResult: any;
    try {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), this.providerTimeoutMs);

      try {
        dispatchResult = await Promise.race([
          provider.dispatch({
            outboxId: message.id,
            to: message.to,
            channel: message.channel,
            templateKey: message.templateKey,
            renderedContent: message.renderedContent,
            vars: message.vars,
            idempotencyKey: message.idempotencyKey || undefined,
            nudgeLogId: message.nudgeLogId || undefined
          }),
          new Promise((_, reject) => {
            abortController.signal.addEventListener('abort', () => {
              reject(new Error(`Provider dispatch timed out after ${this.providerTimeoutMs}ms`));
            });
          })
        ]);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err: any) {
      dispatchResult = {
        outcome: 'FAILED',
        isRetryable: true,
        error: err?.message || String(err)
      };
    }

    // 2. State transition inside a short atomic database transaction, fenced by leaseToken
    try {
      const transitionOutcome = await client.$transaction(async (tx: any) => {
        if (dispatchResult.outcome === 'STUBBED') {
          // Transition OutboxMessage to STUBBED
          const outboxUpdated = await tx.$executeRaw`
            UPDATE outbox_messages
            SET
              status = 'STUBBED',
              "leaseToken" = NULL,
              "lockedAt" = NULL,
              "lockedBy" = NULL,
              "providerMessageId" = ${dispatchResult.providerMessageId || null},
              "updatedAt" = NOW()
            WHERE id = ${message.id}
              AND "leaseToken" = ${claimedToken}
              AND status = 'PROCESSING';
          `;

          if (outboxUpdated === 0) {
            throw new StaleLeaseError(`Lease ${claimedToken} revoked for message ${message.id}`);
          }

          // Atomically transition linked NudgeLog to SIMULATED
          if (message.nudgeLogId) {
            await tx.$executeRaw`
              UPDATE nudge_logs
              SET
                status = 'SIMULATED',
                "updatedAt" = NOW()
              WHERE id = ${message.nudgeLogId};
            `;
          }

          return 'SUCCEEDED';
        } else if (dispatchResult.outcome === 'ACCEPTED') {
          // Real provider accepted message into queue
          const outboxUpdated = await tx.$executeRaw`
            UPDATE outbox_messages
            SET
              status = 'ACCEPTED',
              "leaseToken" = NULL,
              "lockedAt" = NULL,
              "lockedBy" = NULL,
              "providerMessageId" = ${dispatchResult.providerMessageId || null},
              "updatedAt" = NOW()
            WHERE id = ${message.id}
              AND "leaseToken" = ${claimedToken}
              AND status = 'PROCESSING';
          `;

          if (outboxUpdated === 0) {
            throw new StaleLeaseError(`Lease ${claimedToken} revoked for message ${message.id}`);
          }

          if (message.nudgeLogId) {
            await tx.$executeRaw`
              UPDATE nudge_logs
              SET
                status = 'ACCEPTED',
                "updatedAt" = NOW()
              WHERE id = ${message.nudgeLogId}
                AND status != 'SIMULATED';
            `;
          }

          return 'SUCCEEDED';
        } else {
          // Dispatch failed or threw error
          const currentRetries = message.retryCount || 0;
          const maxRetries = message.maxRetries || 3;
          const isRetryable = dispatchResult.isRetryable !== false;
          const errString = String(dispatchResult.error || 'Unknown dispatch failure').slice(0, 1000);

          if (!isRetryable || currentRetries + 1 >= maxRetries) {
            // Terminal dead-letter transition to FAILED
            const outboxUpdated = await tx.$executeRaw`
              UPDATE outbox_messages
              SET
                status = 'FAILED',
                "leaseToken" = NULL,
                "lockedAt" = NULL,
                "lockedBy" = NULL,
                "lastError" = ${errString},
                "updatedAt" = NOW()
              WHERE id = ${message.id}
                AND "leaseToken" = ${claimedToken}
                AND status = 'PROCESSING';
            `;

            if (outboxUpdated === 0) {
              throw new StaleLeaseError(`Lease ${claimedToken} revoked for message ${message.id}`);
            }

            if (message.nudgeLogId) {
              await tx.$executeRaw`
                UPDATE nudge_logs
                SET
                  status = 'FAILED',
                  "error" = ${errString},
                  "updatedAt" = NOW()
                WHERE id = ${message.nudgeLogId}
                  AND status != 'SIMULATED';
              `;
            }

            return 'FAILED';
          } else {
            // Retryable failure with exponential backoff: 30s * 2^retries
            const backoffSeconds = this.baseBackoffSeconds * Math.pow(2, currentRetries);

            const outboxUpdated = await tx.$executeRaw`
              UPDATE outbox_messages
              SET
                status = 'PENDING',
                "leaseToken" = NULL,
                "lockedAt" = NULL,
                "lockedBy" = NULL,
                "retryCount" = "retryCount" + 1,
                "nextRetryAt" = NOW() + (${backoffSeconds} * INTERVAL '1 second'),
                "lastError" = ${errString},
                "updatedAt" = NOW()
              WHERE id = ${message.id}
                AND "leaseToken" = ${claimedToken}
                AND status = 'PROCESSING';
            `;

            if (outboxUpdated === 0) {
              throw new StaleLeaseError(`Lease ${claimedToken} revoked for message ${message.id}`);
            }

            return 'RETRIED';
          }
        }
      });

      return transitionOutcome as any;
    } catch (err: any) {
      if (err instanceof StaleLeaseError) {
        logger.warn(`[OutboxWorker] ${err.message}. State update suppressed to prevent split-brain overwrite.`);
        return 'STALE';
      }
      logger.error(`[OutboxWorker] Error updating state for message ${message.id}: ${err?.message}`, err);
      throw err;
    }
  }

  /**
   * Executes a single polling and processing cycle across a batch.
   */
  async processBatch(client: any = prisma): Promise<ProcessBatchResult> {
    const messages = await this.claimBatch(client);
    const result: ProcessBatchResult = {
      claimedCount: messages.length,
      succeededCount: 0,
      failedCount: 0,
      retriedCount: 0,
      staleCount: 0
    };

    if (messages.length === 0) {
      return result;
    }

    logger.info(`[OutboxWorker] Worker ${this.workerId} claimed ${messages.length} message(s)`);

    for (const msg of messages) {
      try {
        const outcome = await this.processMessage(msg, client);
        if (outcome === 'SUCCEEDED') result.succeededCount++;
        else if (outcome === 'FAILED') result.failedCount++;
        else if (outcome === 'RETRIED') result.retriedCount++;
        else if (outcome === 'STALE') result.staleCount++;
      } catch (err: any) {
        logger.error(`[OutboxWorker] Unhandled error processing message ${msg.id}: ${err?.message}`, err);
      }
    }

    return result;
  }
}
