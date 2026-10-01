import { prisma } from '../../core/prisma';
import { logger } from '../../core/logger';
import { NotificationChannel, NotificationStatus } from '@prisma/client';

export interface NotificationPayload {
  tenantId: string;
  customerId?: string;
  eventType: string;
  recipient: string;
  channel: NotificationChannel;
  title: string;
  message: string;
}

export class NotificationService {
  async send(payload: NotificationPayload) {
    logger.info(`[NotificationService] Sending ${payload.channel} to ${payload.recipient}: ${payload.title}`);
    
    // If external messaging gateway (Twilio, WhatsApp Business API, Sendgrid, etc.) is not configured,
    // keep status as PENDING and do not pretend delivery was successful.
    const isGatewayConfigured = false; // Real provider integration pending configuration

    const notif = await prisma.notification.create({
      data: {
        tenantId: payload.tenantId,
        customerId: payload.customerId,
        eventType: payload.eventType,
        channel: payload.channel,
        recipient: payload.recipient,
        title: payload.title,
        message: payload.message,
        status: isGatewayConfigured ? NotificationStatus.SENT : NotificationStatus.PENDING
      }
    });

    if (!isGatewayConfigured) {
      logger.info(`[NotificationService] Messaging integration is not configured. Queued as PENDING for ${payload.recipient}`);
      return notif;
    }

    // Adapter dispatch (when configured)
    if (payload.channel === NotificationChannel.WHATSAPP) {
      await this.sendWhatsApp(payload.recipient, payload.message);
    } else if (payload.channel === NotificationChannel.EMAIL) {
      await this.sendEmail(payload.recipient, payload.title, payload.message);
    }

    return notif;
  }

  private async sendWhatsApp(phone: string, msg: string) {
    logger.info(`[WhatsAppAdapter] Messaging gateway not configured for ${phone}`);
    return false;
  }

  private async sendEmail(email: string, subject: string, body: string) {
    logger.info(`[EmailAdapter] Messaging gateway not configured for ${email}`);
    return false;
  }
}

export const notificationService = new NotificationService();
