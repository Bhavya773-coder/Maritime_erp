import prisma from '../../config/db';
import { BotChannel } from '@prisma/client';
import { BotNotificationService } from './bot.notification-service';

export class BotPersonalReminderService {
  /**
   * Process due personal reminders and notify users.
   * Returns statistics about how many were checked, sent, completed, and skipped.
   */
  public static async processDuePersonalReminders(): Promise<{
    checked: number;
    sent: number;
    completed: number;
    skipped: number;
  }> {
    const now = new Date();

    const dueReminders = await prisma.personalReminder.findMany({
      where: {
        status: 'PENDING',
        remindAt: {
          lte: now,
        },
      },
      include: {
        user: true,
      },
    });

    let checked = 0;
    let sent = 0;
    let completed = 0;
    let skipped = 0;

    for (const reminder of dueReminders) {
      checked++;

      const userContact = await prisma.userContact.findFirst({
        where: {
          userId: reminder.userId,
          channel: BotChannel.WHATSAPP,
        },
      });

      if (userContact) {
        try {
          await BotNotificationService.sendPersonalReminder(
            reminder.userId,
            userContact.phoneNumber,
            reminder.title,
            reminder.description || undefined
          );
          sent++;
          
          await prisma.personalReminder.update({
            where: { id: reminder.id },
            data: { status: 'COMPLETED' },
          });
          completed++;
        } catch (err) {
          console.error(`[BotPersonalReminderService] Failed to send reminder to ${reminder.user.name}:`, err);
          skipped++;
          await prisma.personalReminder.update({
            where: { id: reminder.id },
            data: { status: 'FAILED' },
          });
        }
      } else {
        console.warn(`[BotPersonalReminderService] No WhatsApp contact for user ${reminder.user.name}. Skipping.`);
        skipped++;
        await prisma.personalReminder.update({
          where: { id: reminder.id },
          data: { status: 'FAILED' },
        });
      }
    }

    return { checked, sent, completed, skipped };
  }

  /**
   * Create a new personal reminder for a user.
   */
  public static async createPersonalReminder(
    userId: string,
    title: string,
    description: string | null,
    remindAt: Date
  ) {
    return prisma.personalReminder.create({
      data: {
        userId,
        title,
        description: description || null,
        remindAt,
        status: 'PENDING',
      },
    });
  }

  /**
   * Get all personal reminders for a user.
   */
  public static async getPersonalReminders(userId: string) {
    return prisma.personalReminder.findMany({
      where: { userId },
      orderBy: { remindAt: 'asc' },
    });
  }

  /**
   * Cancel a personal reminder by ID (only if it belongs to the user).
   */
  public static async cancelPersonalReminder(id: string, userId: string) {
    const reminder = await prisma.personalReminder.findFirst({
      where: { id, userId },
    });

    if (!reminder) {
      throw new Error('Personal reminder not found or access denied.');
    }

    return prisma.personalReminder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }
}
