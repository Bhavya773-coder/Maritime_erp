import prisma from '../../config/db';
import { User, Role, BotChannel } from '@prisma/client';
import { ReplyCommand } from './bot.reply-parser';
import { WhatsAppService } from './whatsapp.service';
import { BotService } from './bot.service';

export class BotReplyService {
  public static async executeReplyCommand(
    sender: User,
    command: ReplyCommand,
    fromPhone: string,
    providerMessageId?: string
  ): Promise<any> {
    // Audit log command received
    await prisma.auditLog.create({
      data: {
        userId: sender.id,
        action: 'BOT_REPLY_COMMAND_RECEIVED',
        details: `Reply command: ${command.type} (Message ID: ${providerMessageId || 'N/A'})`,
      },
    });

    // 1. HELP command
    if (command.type === 'HELP') {
      const helpText = 'Commands: DONE, UPDATE: message, STATUS, HELP. You can also ask: where is ARCADIA 1, list barges, list tugs.';
      await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, helpText);
      return { status: 'success', message: helpText };
    }

    // 2. STATUS command
    if (command.type === 'STATUS') {
      const activeTasks = await prisma.task.findMany({
        where: {
          assignedToId: sender.id,
          status: { not: 'COMPLETED' },
          isDeleted: false,
          deletedAt: null,
          botCommands: {
            some: {},
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          botReminders: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (activeTasks.length === 0) {
        const replyText = 'No active bot task found for you.';
        await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, replyText);
        return { status: 'success', message: replyText };
      }

      let replyText = 'Your active tasks:\n';
      activeTasks.forEach((t, i) => {
        const nextRem = t.botReminders[0]?.nextReminderAt;
        const nextRemStr = nextRem ? nextRem.toISOString() : 'None';
        replyText += `${i + 1}. ${t.title}\n   Status: ${t.status}\n   Due: ${t.dueDate.toISOString()}\n   Next Reminder: ${nextRemStr}\n   ID: ${t.id}\n`;
      });

      await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, replyText);
      return { status: 'success', message: replyText };
    }

    // For DONE and UPDATE, resolve task
    const resolved = await this.resolveTaskForUser(sender.id, sender.role, command.targetTaskId);

    if (resolved.error) {
      await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, resolved.error);
      return { status: 'error', message: resolved.error };
    }

    if (resolved.multipleTasks) {
      let replyText = `You have multiple active tasks. Please specify which task you want to complete by replying with the command and the Task ID:\n`;
      resolved.multipleTasks.forEach((t, i) => {
        replyText += `${i + 1}. ${t.title} (ID: ${t.id})\n`;
      });
      replyText += `Example: DONE ${resolved.multipleTasks[0].id}`;

      await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, replyText);
      return { status: 'NEEDS_CONFIRMATION', message: replyText, tasks: resolved.multipleTasks };
    }

    const task = resolved.task!;

    // Action Execution
    if (command.type === 'DONE') {
      // Mark task completed
      const updatedTask = await prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
        include: {
          creator: true,
        },
      });

      // Mark related BotReminders COMPLETED
      await prisma.botReminder.updateMany({
        where: {
          taskId: task.id,
          status: 'ACTIVE',
        },
        data: {
          status: 'COMPLETED',
        },
      });

      // Add task comment
      await prisma.taskComment.create({
        data: {
          taskId: task.id,
          userId: sender.id,
          content: 'Completed via WhatsApp.',
        },
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          userId: sender.id,
          action: 'BOT_TASK_COMPLETED',
          details: `Task "${task.title}" (ID: ${task.id}) marked completed via WhatsApp by ${sender.name}.`,
        },
      });

      // Send confirmation reply to sender (acknowledgement)
      const confirmationText = `Task marked completed: ${task.title}`;
      const senderMsg = await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, confirmationText);

      // Notify creator: "[Sender Name] completed: [Task Title]"
      let creatorMsg: any = null;
      const creatorContact = await prisma.userContact.findFirst({
        where: {
          userId: updatedTask.createdById,
          channel: BotChannel.WHATSAPP,
        },
      });

      if (creatorContact) {
        const creatorText = `${sender.name} completed: ${task.title}`;
        creatorMsg = await WhatsAppService.sendWhatsAppAndLog(updatedTask.createdById, creatorContact.phoneNumber, creatorText);
      }

      return {
        status: 'success',
        data: {
          task: updatedTask,
          notifications: creatorMsg ? [senderMsg, creatorMsg] : [senderMsg],
        },
      };
    }

    if (command.type === 'UPDATE') {
      const updateMsg = command.message || '';
      
      // Update task status to IN_PROGRESS unless already COMPLETED
      const newStatus = task.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS';
      const updatedTask = await prisma.task.update({
        where: { id: task.id },
        data: {
          status: newStatus,
        },
        include: {
          creator: true,
        },
      });

      // Add task comment
      await prisma.taskComment.create({
        data: {
          taskId: task.id,
          userId: sender.id,
          content: updateMsg,
        },
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          userId: sender.id,
          action: 'BOT_TASK_UPDATED',
          details: `Task "${task.title}" updated via WhatsApp: "${updateMsg}"`,
        },
      });

      // Send confirmation reply to sender
      const confirmationText = `Update added to task: ${task.title}`;
      const senderMsg = await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, confirmationText);

      // Notify creator
      let creatorMsg: any = null;
      const creatorContact = await prisma.userContact.findFirst({
        where: {
          userId: updatedTask.createdById,
          channel: BotChannel.WHATSAPP,
        },
      });

      if (creatorContact) {
        const creatorText = `${sender.name} updated task ${task.title}: ${updateMsg}`;
        creatorMsg = await WhatsAppService.sendWhatsAppAndLog(updatedTask.createdById, creatorContact.phoneNumber, creatorText);
      }

      return {
        status: 'success',
        data: {
          task: updatedTask,
          notifications: creatorMsg ? [senderMsg, creatorMsg] : [senderMsg],
        },
      };
    }

    if (command.type === 'DELEGATE') {
      if (!command.assigneeName) {
        await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, 'Please specify an assignee to delegate to.');
        return { status: 'error', message: 'Please specify an assignee to delegate to.' };
      }

      const candidates = await BotService.resolveAssignee(command.assigneeName);
      if (candidates.length === 0) {
        const replyText = `Could not resolve assignee "${command.assigneeName}".`;
        await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, replyText);
        return { status: 'error', message: replyText };
      }
      if (candidates.length > 1) {
        let replyText = `Multiple matches found for "${command.assigneeName}":\n`;
        candidates.forEach((c, i) => {
          replyText += `${i + 1}. ${c.name} (${c.department})\n`;
        });
        await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, replyText);
        return { status: 'NEEDS_CONFIRMATION', message: replyText, options: candidates };
      }

      const assignee = candidates[0];

      // Update task assignee and status to DELEGATED
      const updatedTask = await prisma.task.update({
        where: { id: task.id },
        data: {
          assignedToId: assignee.id,
          status: 'DELEGATED',
        },
        include: {
          creator: true,
        },
      });

      // Update reminder to new assignee
      await prisma.botReminder.updateMany({
        where: { taskId: task.id, status: 'ACTIVE' },
        data: { assignedToId: assignee.id },
      });

      const note = command.message || 'Delegated via WhatsApp';

      // Create task delegation log
      await prisma.taskDelegationLog.create({
        data: {
          taskId: task.id,
          fromUserId: sender.id,
          toUserId: assignee.id,
          note,
        },
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          userId: sender.id,
          action: 'BOT_TASK_DELEGATED',
          details: `Task "${task.title}" delegated to ${assignee.name} by ${sender.name}.`,
        },
      });

      // Send confirmation to sender
      const confirmationText = `Task delegated to ${assignee.name}: ${task.title}`;
      const senderMsg = await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, confirmationText);

      // Notify new assignee
      let assigneeMsg: any = null;
      const assigneeContact = await prisma.userContact.findFirst({
        where: { userId: assignee.id, channel: BotChannel.WHATSAPP },
      });
      if (assigneeContact) {
        const assigneeText = `New task delegated to you by ${sender.name}: ${task.title}. Note: ${note}`;
        assigneeMsg = await WhatsAppService.sendWhatsAppAndLog(assignee.id, assigneeContact.phoneNumber, assigneeText);
      }

      return {
        status: 'success',
        data: {
          task: updatedTask,
          notifications: assigneeMsg ? [senderMsg, assigneeMsg] : [senderMsg],
        },
      };
    }

    return { status: 'error', message: 'Unknown reply command.' };
  }

  private static async resolveTaskForUser(
    userId: string,
    userRole: Role,
    targetTaskId?: string
  ): Promise<{ task?: any; error?: string; multipleTasks?: any[] }> {
    if (targetTaskId) {
      const whereClause: any = {
        id: targetTaskId,
        status: { not: 'COMPLETED' },
        isDeleted: false,
        deletedAt: null,
      };
      if (userRole !== Role.OWNER) {
        whereClause.assignedToId = userId;
      }
      const task = await prisma.task.findFirst({
        where: whereClause,
      });
      if (!task) {
        return { error: `Task not found or not accessible: ${targetTaskId}` };
      }
      return { task };
    }

    // Else find active bot-created tasks assigned to the user
    const activeTasks = await prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: { not: 'COMPLETED' },
        isDeleted: false,
        deletedAt: null,
        botCommands: {
          some: {}, // Has at least one BotCommand
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (activeTasks.length === 0) {
      return { error: 'No active bot task found for you.' };
    }

    if (activeTasks.length > 1) {
      return { multipleTasks: activeTasks };
    }

    return { task: activeTasks[0] };
  }
}
