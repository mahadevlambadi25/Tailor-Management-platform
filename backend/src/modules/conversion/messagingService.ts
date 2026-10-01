import { prisma } from '../../core/prisma';
import { logger } from '../../core/logger';
import { NotificationChannel } from '@prisma/client';

export interface SendMessageOptions {
  to: string;
  templateKey: string;
  vars: Record<string, any>;
  tenantId: string;
  channel?: NotificationChannel;
}

export const MESSAGE_TEMPLATES: Record<string, string> = {
  order_update: "Hi {{customerName}}, your {{garmentType}} (Order #{{orderNumber}}) has moved to {{stage}} stage at {{shopName}}. Estimated delivery: {{deliveryDate}}.",
  staff_invite: "Hi {{name}}, you have been invited to join {{shopName}} as {{role}}. Sign in at: {{link}}",
  aha_preview: "Hi {{customerName}}, your tailoring order has moved to the cutting table! We'll keep you posted every step. - {{shopName}}",
  nudge_1h: "Hi {{firstName}}, your sample shop is ready and waiting. Take a look, it only takes a minute: {{link}}",
  nudge_24h_no_customer: "Hi {{firstName}}, think of the last customer who walked in. Add them now and you'll never look for their measurements in a notebook again. {{link}}",
  nudge_first_order_no_staff: "Your first order is in. Now let your cutter see it too, so nobody has to ask 'what's next?' {{link}}",
  nudge_day7_active: "One week in. {{orderCount}} orders tracked, {{readyCount}} ready on time. This is what a calm shop looks like.",
  nudge_day7_inactive: "Busy week? That's exactly why we built this. Five minutes tonight and tomorrow's orders are sorted. {{link}}",
  nudge_day11: "3 days left in your trial. Everything you've added stays yours when you continue. {{upgradeLink}}",
  nudge_day13: "Tomorrow your trial ends. Keep your {{customerCount}} customers and {{orderCount}} orders moving. {{upgradeLink}}",
  payment_recovery_1h: "Looks like your payment didn't go through. Here's your link to finish in a minute: {{payLink}}",
  payment_recovery_24h: "Your customers are still in your shop, {{firstName}}. Finish here whenever you're ready: {{payLink}}",
  payment_recovery_3d: "Last reminder from us. Your shop is saved and waiting: {{payLink}}"
};

export class MessageSender {
  /**
   * Renders a message template by substituting {{variable}} placeholders.
   */
  static render(templateKey: string, vars: Record<string, any>): string {
    const template = MESSAGE_TEMPLATES[templateKey] || 'Notification from {{shopName}}: {{message}}';
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
      return vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`;
    });
  }

  /**
   * Stubs sending a message by recording in OutboxMessage table.
   * GUARANTEE: Never sends actual SMS or WhatsApp messages externally from the stub.
   */
  static async send(options: SendMessageOptions): Promise<{ id: string; rendered: string; waLink: string }> {
    const { to, templateKey, vars, tenantId, channel = NotificationChannel.WHATSAPP } = options;
    const rendered = this.render(templateKey, vars);

    const cleanPhone = to.replace(/[^0-9]/g, '');
    const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(rendered)}`;

    logger.info(`[MessageSender STUB] Message created for ${to} [${templateKey}]: ${rendered}`);

    const outboxRecord = await prisma.outboxMessage.create({
      data: {
        tenantId,
        channel,
        to,
        templateKey,
        vars: vars as any,
        renderedContent: rendered,
        status: 'STUBBED'
      }
    });

    return {
      id: outboxRecord.id,
      rendered,
      waLink
    };
  }
}

export class EmailSender {
  /**
   * Sends or stubs an email message.
   */
  static async send(
    to: string,
    subject: string,
    html: string,
    text: string,
    tenantId: string
  ): Promise<{ id: string }> {
    logger.info(`[EmailSender STUB] Email created for ${to} with subject "${subject}"`);

    const outboxRecord = await prisma.outboxMessage.create({
      data: {
        tenantId,
        channel: NotificationChannel.EMAIL,
        to,
        templateKey: subject,
        vars: { subject, text },
        renderedContent: html || text,
        status: 'STUBBED'
      }
    });

    return { id: outboxRecord.id };
  }
}
