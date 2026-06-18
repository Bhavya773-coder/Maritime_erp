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
      const overdueLabel = isOverdue ? '⚠️ OVERDUE' : '⏰ Pending';

      // --- Send reminder to ASSIGNEE ---
      const assigneeContact = await prisma.userContact.findFirst({
        where: {
          userId: reminder.assignedToId,
          channel: BotChannel.WHATSAPP,
        },
      });

      if (assigneeContact) {
        let assigneeText = `${overdueLabel}: "${task.title}" (Due: ${dueDateStr}). Reply DONE, UPDATE: <message>, or DELEGATE: <name>.`;
        await WhatsAppService.sendWhatsAppAndLog(
          reminder.assignedToId,
          assigneeContact.phoneNumber,
          assigneeText
        );
        sent++;
      }

      // --- Send reminder to CREATOR (only if creator != assignee) ---
      if (task.createdById !== reminder.assignedToId) {
        const creatorContact = await prisma.userContact.findFirst({
          where: {
            userId: task.createdById,
            channel: BotChannel.WHATSAPP,
          },
        });

        if (creatorContact) {
          const assigneeName = task.assignee?.name || 'Unknown';
          let creatorText = `${overdueLabel}: Task "${task.title}" assigned to ${assigneeName} (Due: ${dueDateStr}) is still not done.`;
          if (lastComment) {
            creatorText += `\nLast update: "${lastComment}"`;
          }
          await WhatsAppService.sendWhatsAppAndLog(
            task.createdById,
            creatorContact.phoneNumber,
            creatorText
          );
          sent++;
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

      if (!assigneeContact) {
        skipped++;
      }
    }

    return {
      checked,
      sent,
      completed,
      skipped,
    };
  }
}
