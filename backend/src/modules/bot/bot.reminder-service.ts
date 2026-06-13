import prisma from '../../config/db';
import { BotChannel } from '@prisma/client';
import { WhatsAppService } from './whatsapp.service';

export class BotReminderService {
  public static async processDueReminders(): Promise<{
    checked: number;
    sent: number;
    completed: number;
    skipped: number;
  }> {
    const now = new Date();

    // Find BotReminder where status ACTIVE and nextReminderAt <= now
    const dueReminders = await prisma.botReminder.findMany({
      where: {
        status: 'ACTIVE',
        nextReminderAt: {
          lte: now,
        },
      },
      include: {
        task: true,
        assignedTo: true,
      },
    });

    let checked = 0;
    let sent = 0;
    let completed = 0;
    let skipped = 0;

    for (const reminder of dueReminders) {
      checked++;
      
      // Check if task is completed or deleted
      if (reminder.task.status === 'COMPLETED' || reminder.task.isDeleted || reminder.task.deletedAt) {
        await prisma.botReminder.update({
          where: { id: reminder.id },
          data: { status: 'COMPLETED' },
        });
        completed++;
        continue;
      }

      // Find if assignee has a verified UserContact for WHATSAPP
      const contact = await prisma.userContact.findFirst({
        where: {
          userId: reminder.assignedToId,
          channel: BotChannel.WHATSAPP,
        },
      });

      if (!contact) {
        // No contact to send to, skip but update nextReminderAt to prevent infinite looping
        const nextRem = new Date(now.getTime() + reminder.frequencyHours * 60 * 60 * 1000);
        await prisma.botReminder.update({
          where: { id: reminder.id },
          data: {
            nextReminderAt: nextRem,
            lastReminderAt: now,
          },
        });
        skipped++;
        continue;
      }

      // Send WhatsApp reminder
      const reminderText = `Reminder: Task pending — ${reminder.task.title}. Reply DONE or UPDATE: message.`;
      
      await WhatsAppService.sendWhatsAppAndLog(
        reminder.assignedToId,
        contact.phoneNumber,
        reminderText
      );

      // Update reminder timestamps
      const nextRem = new Date(now.getTime() + reminder.frequencyHours * 60 * 60 * 1000);
      await prisma.botReminder.update({
        where: { id: reminder.id },
        data: {
          lastReminderAt: now,
          nextReminderAt: nextRem,
        },
      });

      sent++;
    }

    return {
      checked,
      sent,
      completed,
      skipped,
    };
  }
}
