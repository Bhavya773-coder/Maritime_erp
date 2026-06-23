import prisma from '../../config/db';
import { BotChannel } from '@prisma/client';
import { WhatsAppService } from './whatsapp.service';
import { BotNotificationService } from './bot.notification-service';

export class BotReminderService {
  /**
   * Check if current time is within business hours (08:00-20:00)
   */
  private static isBusinessHours(): boolean {
    const hour = new Date().getHours();
    return hour >= 8 && hour < 20;
  }

  public static async processDueReminders(): Promise<{
    checked: number;
    sent: number;
    completed: number;
    skipped: number;
    escalated: number;
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
    let escalated = 0;

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
      const isOverdue = task.dueDate ? new Date(task.dueDate) < now : false;
      const dueDateStr = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : 'No due date';
      const lastComment = task.comments[0]?.content || null;

      // Calculate hours overdue for escalation
      let hoursOverdue = 0;
      if (task.dueDate && isOverdue) {
        hoursOverdue = Math.floor((now.getTime() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60));
      }

      // Escalation logic
      if (hoursOverdue > 72) {
        // Escalate to OWNER
        await this.escalateToOwner(task, hoursOverdue, dueDateStr, lastComment);
        escalated++;
      } else if (hoursOverdue > 24) {
        // Escalate to MANAGEMENT
        await this.escalateToManagement(task, hoursOverdue, dueDateStr, lastComment);
        escalated++;
      }

      // Acknowledgement check: if task not acknowledged, send reminder to assignee
      if (!task.acknowledgedAt) {
        const assigneeContact = await prisma.userContact.findFirst({
          where: { userId: reminder.assignedToId, channel: BotChannel.WHATSAPP },
        });
        if (assigneeContact && assigneeContact.phoneNumber) {
          try {
            await BotNotificationService.sendTextNotification(
              reminder.assignedToId,
              assigneeContact.phoneNumber,
              `⏰ Please acknowledge your task: "${task.title}" (Due: ${dueDateStr}). Reply OK to confirm.`
            );
            sent++;
          } catch (err) {
            console.error(`[BotReminderService] Ack reminder failed:`, err);
            skipped++;
          }
        }
        // Update next reminder to be in 2 hours (acknowledgement nag)
        await prisma.botReminder.update({
          where: { id: reminder.id },
          data: { nextReminderAt: new Date(now.getTime() + 2 * 60 * 60 * 1000) },
        });
        continue;
      }

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
      escalated,
    };
  }

  private static async escalateToManagement(
    task: any,
    hoursOverdue: number,
    dueDateStr: string,
    lastComment: string | null
  ): Promise<void> {
    const managers = await prisma.user.findMany({
      where: { role: { in: ['MANAGER', 'FLEET_MANAGER'] }, isActive: true },
    });
    for (const manager of managers) {
      const contact = await prisma.userContact.findFirst({
        where: { userId: manager.id, channel: BotChannel.WHATSAPP },
      });
      if (contact?.phoneNumber) {
        const assigneeName = task.assignee?.name || 'Unknown';
        let text = `🚨 ESCALATION: Task "${task.title}" assigned to ${assigneeName} is OVERDUE by ${hoursOverdue} hours (Due: ${dueDateStr}).`;
        if (lastComment) text += `\nLast update: "${lastComment}"`;
        await WhatsAppService.sendWhatsAppAndLog(manager.id, contact.phoneNumber, text);
      }
    }
  }

  private static async escalateToOwner(
    task: any,
    hoursOverdue: number,
    dueDateStr: string,
    lastComment: string | null
  ): Promise<void> {
    const owners = await prisma.user.findMany({
      where: { role: 'OWNER', isActive: true },
    });
    for (const owner of owners) {
      const contact = await prisma.userContact.findFirst({
        where: { userId: owner.id, channel: BotChannel.WHATSAPP },
      });
      if (contact?.phoneNumber) {
        const assigneeName = task.assignee?.name || 'Unknown';
        let text = `🔴 CRITICAL ESCALATION: Task "${task.title}" assigned to ${assigneeName} is OVERDUE by ${hoursOverdue} hours and requires immediate intervention. Due: ${dueDateStr}.`;
        if (lastComment) text += `\nLast update: "${lastComment}"`;
        await WhatsAppService.sendWhatsAppAndLog(owner.id, contact.phoneNumber, text);
      }
    }
  }
}
