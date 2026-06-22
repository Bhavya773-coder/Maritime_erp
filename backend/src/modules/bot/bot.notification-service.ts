import prisma from '../../config/db';
import { BotChannel } from '@prisma/client';
import { WhatsAppService } from './whatsapp.service';
import { env } from '../../config/env';

export class BotNotificationService {
  /**
   * Check if user is within the 24-hour WhatsApp conversation window.
   * Returns true if the user has sent an incoming message within the last 24 hours.
   */
  public static async isWithinConversationWindow(userId: string): Promise<boolean> {
    const lastIncoming = await prisma.botMessage.findFirst({
      where: {
        direction: 'INCOMING',
        channel: BotChannel.WHATSAPP,
        fromUserId: userId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastIncoming) return false;

    const windowMs = 24 * 60 * 60 * 1000;
    const lastTime = new Date(lastIncoming.createdAt).getTime();
    const now = Date.now();

    return (now - lastTime) < windowMs;
  }

  /**
   * Send task assignment notification to assignee.
   * Uses template if available (bypasses 24h window for new users).
   * Falls back to interactive buttons if user is within the 24h window.
   * Falls back to plain text if outside window and no template configured.
   */
  public static async sendTaskAssignment(
    toUserId: string,
    toPhone: string,
    senderName: string,
    taskTitle: string,
    taskId: string
  ): Promise<any> {
    const cleanPhone = WhatsAppService.normalizePhone(toPhone);
    const messageText = `New task from ${senderName}: ${taskTitle}. Reply UPDATE, DONE, or DELEGATE.`;

    // Template messages bypass the 24h window and are always deliverable
    if (env.WHATSAPP_TEMPLATE_NAME) {
      // sendWhatsAppAndLog will auto-detect the template pattern and use the template
      const templateMsg = await WhatsAppService.sendWhatsAppAndLog(toUserId, cleanPhone, messageText);

      // If user is within conversation window, also send interactive buttons for convenience
      const inWindow = await this.isWithinConversationWindow(toUserId);
      if (inWindow) {
        try {
          await WhatsAppService.sendWhatsAppTaskButtonsAndLog(toUserId, cleanPhone, messageText, taskId);
        } catch (btnErr) {
          console.warn('[BotNotificationService] Buttons follow-up failed (non-critical):', btnErr);
        }
      }

      return templateMsg;
    }

    // No template configured — check conversation window
    const inWindow = await this.isWithinConversationWindow(toUserId);
    if (inWindow) {
      return await WhatsAppService.sendWhatsAppTaskButtonsAndLog(toUserId, cleanPhone, messageText, taskId);
    } else {
      console.warn(
        `[BotNotificationService] Cannot send task assignment to ${cleanPhone} — user outside 24h window and no template configured. Consider setting WHATSAPP_TEMPLATE_NAME.`
      );
      // Still attempt to send plain text (will simulate in dev, may fail in production)
      return await WhatsAppService.sendWhatsAppAndLog(toUserId, cleanPhone, messageText);
    }
  }

  /**
   * Send task delegation notification to new assignee.
   * Uses template if available (bypasses 24h window for new users).
   */
  public static async sendTaskDelegation(
    toUserId: string,
    toPhone: string,
    senderName: string,
    taskTitle: string,
    note: string,
    taskId: string
  ): Promise<any> {
    const cleanPhone = WhatsAppService.normalizePhone(toPhone);
    const messageText = `New task delegated to you by ${senderName}: ${taskTitle}. Note: ${note || 'Delegated'}`;

    if (env.WHATSAPP_TEMPLATE_NAME) {
      const templateMsg = await WhatsAppService.sendWhatsAppAndLog(toUserId, cleanPhone, messageText);

      const inWindow = await this.isWithinConversationWindow(toUserId);
      if (inWindow) {
        try {
          await WhatsAppService.sendWhatsAppTaskButtonsAndLog(toUserId, cleanPhone, messageText, taskId);
        } catch (btnErr) {
          console.warn('[BotNotificationService] Buttons follow-up failed (non-critical):', btnErr);
        }
      }

      return templateMsg;
    }

    const inWindow = await this.isWithinConversationWindow(toUserId);
    if (inWindow) {
      return await WhatsAppService.sendWhatsAppTaskButtonsAndLog(toUserId, cleanPhone, messageText, taskId);
    } else {
      console.warn(
        `[BotNotificationService] Cannot send task delegation to ${cleanPhone} — user outside 24h window and no template configured. Consider setting WHATSAPP_TEMPLATE_NAME.`
      );
      return await WhatsAppService.sendWhatsAppAndLog(toUserId, cleanPhone, messageText);
    }
  }

  /**
   * Send task reminder notification.
   * If user is within the 24h window, sends interactive buttons.
   * Otherwise, sends plain text reminder.
   */
  public static async sendTaskReminder(
    toUserId: string,
    toPhone: string,
    taskTitle: string,
    dueDateStr: string,
    isOverdue: boolean,
    taskId: string
  ): Promise<any> {
    const cleanPhone = WhatsAppService.normalizePhone(toPhone);
    const overdueLabel = isOverdue ? '⚠️ OVERDUE' : '⏰ Pending';
    const messageText = `${overdueLabel}: "${taskTitle}" (Due: ${dueDateStr}).`;

    const inWindow = await this.isWithinConversationWindow(toUserId);
    if (inWindow) {
      return await WhatsAppService.sendWhatsAppTaskButtonsAndLog(toUserId, cleanPhone, messageText, taskId);
    } else {
      // Outside 24h window — send plain text reminder
      const fallbackText = `${overdueLabel}: "${taskTitle}" (Due: ${dueDateStr}). Reply to this message to update the task.`;
      return await WhatsAppService.sendWhatsAppAndLog(toUserId, cleanPhone, fallbackText);
    }
  }

  /**
   * Send a generic text notification (for updates, acknowledgements, etc.).
   */
  public static async sendTextNotification(
    toUserId: string | null,
    toPhone: string,
    messageText: string
  ): Promise<any> {
    const cleanPhone = WhatsAppService.normalizePhone(toPhone);
    return await WhatsAppService.sendWhatsAppAndLog(toUserId, cleanPhone, messageText);
  }

  /**
   * Send a personal reminder notification.
   */
  public static async sendPersonalReminder(
    toUserId: string,
    toPhone: string,
    title: string,
    description?: string
  ): Promise<any> {
    const cleanPhone = WhatsAppService.normalizePhone(toPhone);
    let messageText = `🔔 Reminder: ${title}`;
    if (description) {
      messageText += `\n${description}`;
    }
    return await WhatsAppService.sendWhatsAppAndLog(toUserId, cleanPhone, messageText);
  }
}
