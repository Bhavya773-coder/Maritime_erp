import prisma from '../../config/db';
import { BotChannel } from '@prisma/client';
import { WhatsAppService } from './whatsapp.service';
import { BotNotificationService } from './bot.notification-service';

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
        task: {
          include: {
            creator: true,
            assignee: true,
            comments: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
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

      const task = reminder.task;
      const isOverdue = task.dueDate && new Date(task.dueDate) < now;
      const dueDateStr = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : 'No due date';
      const lastComment = task.comments[0]?.content || null;

      // --- Send reminder to ASSIGNEE using notification service (handles 24h window) ---
      const assigneeContact = await prisma.userContact.findFirst({
        where: {
          userId: reminder.assignedToId,
          channel: BotChannel.WHATSAPP,
        },
      });

      if (assigneeContact && assigneeContact.phoneNumber) {
        try {
          await BotNotificationService.sendTaskReminder(
            reminder.assignedToId,
            assigneeContact.phoneNumber,
            task.title,
            dueDateStr,
            isOverdue,
            task.id
          );
          sent++;
        } catch (err) {
          console.error(`[BotReminderService] Failed to send reminder to assignee ${reminder.assignedTo.name}:`, err);
          skipped++;
        }
      } else {
        console.warn(`[BotReminderService] No WhatsApp contact for assignee ${reminder.assignedTo.name}. Reminder skipped.`);
        skipped++;
      }

      // --- Send reminder to CREATOR (only if creator != assignee) ---
      if (task.createdById !== reminder.assignedToId) {
        const creatorContact = await prisma.userContact.findFirst({
          where: {
            userId: task.createdById,
            channel: BotChannel.WHATSAPP,
          },
        });

        if (creatorContact && creatorContact.phoneNumber) {
          try {
            const assigneeName = task.assignee?.name || 'Unknown';
            let creatorText = isOverdue
              ? `⚠️ OVERDUE: Task "${task.title}" assigned to ${assigneeName} (Due: ${dueDateStr}) is still not done.`
              : `⏰ Pending: Task "${task.title}" assigned to ${assigneeName} (Due: ${dueDateStr}) is still not done.`;
            if (lastComment) {
              creatorText += `\nLast update: "${lastComment}"`;
            }
            await WhatsAppService.sendWhatsAppAndLog(
              task.createdById,
              creatorContact.phoneNumber,
              creatorText
            );
            sent++;
          } catch (err) {
            console.error(`[BotReminderService] Failed to send reminder to creator ${task.creator.name}:`, err);
          }
        }
      }

      // Update reminder timestamps
      const nextRem = new Date(now.getTime() + reminder.frequencyHours * 60 * 60 * 1000);
      await prisma.botReminder.update({
        where: { id: reminder.id },
        data: {
          lastReminderAt: now,
          nextReminderAt: nextRem,
        },
      });
    }

    return {
      checked,
      sent,
      completed,
      skipped,
    };
  }
}
