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
    
    // Create record in database
    const notif = await prisma.notification.create({
      data: {
        tenantId: payload.tenantId,
        customerId: payload.customerId,
        eventType: payload.eventType,
        channel: payload.channel,
        recipient: payload.recipient,
        title: payload.title,
        message: payload.message,
        status: NotificationStatus.SENT
      }
    });

    // Adapter dispatch
    if (payload.channel === NotificationChannel.WHATSAPP) {
      await this.sendWhatsApp(payload.recipient, payload.message);
    } else if (payload.channel === NotificationChannel.EMAIL) {
      await this.sendEmail(payload.recipient, payload.title, payload.message);
    }

    return notif;
  }

  private async sendWhatsApp(phone: string, msg: string) {
    // WhatsApp adapter hook (e.g. Twilio / Meta Cloud API)
    logger.info(`[WhatsAppAdapter] Simulated message delivered to ${phone}: "${msg}"`);
    return true;
  }

  private async sendEmail(email: string, subject: string, body: string) {
    // Email adapter hook (e.g. Sendgrid / SMTP)
    logger.info(`[EmailAdapter] Simulated email delivered to ${email}: "${subject}"`);
    return true;
  }
}

export const notificationService = new NotificationService();
