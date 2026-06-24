import prisma from '../../config/db';
import { User, Role, BotChannel } from '@prisma/client';
import { ReplyCommand } from './bot.reply-parser';
import { WhatsAppService } from './whatsapp.service';
import { BotService } from './bot.service';
import { BotNotificationService } from './bot.notification-service';

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
        replyText += `${i + 1}. ${t.title}\n   Status: ${t.status}\n   Due: ${t.dueDate ? t.dueDate.toISOString() : 'No due date'}\n   Next Reminder: ${nextRemStr}\n   ID: ${t.id}\n`;
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

      // Notify new assignee using notification service (handles 24h window + templates)
      let assigneeMsg: any = null;
      const assigneeContact = await prisma.userContact.findFirst({
        where: { userId: assignee.id, channel: BotChannel.WHATSAPP },
      });
      if (assigneeContact && assigneeContact.phoneNumber) {
        assigneeMsg = await BotNotificationService.sendTaskDelegation(
          assignee.id,
          assigneeContact.phoneNumber,
          sender.name,
          task.title,
          note,
          task.id
        );
      } else {
        console.warn(`[BotReplyService] No WhatsApp contact for assignee ${assignee.name}. Delegation notification skipped.`);
      }

      // Notify task creator
      let creatorMsg: any = null;
      const creatorContact = await prisma.userContact.findFirst({
        where: { userId: updatedTask.createdById, channel: BotChannel.WHATSAPP },
      });
      if (creatorContact && creatorContact.phoneNumber && updatedTask.createdById !== sender.id) {
        const creatorText = `${sender.name} delegated task "${task.title}" to ${assignee.name}. Note: ${note}`;
        creatorMsg = await WhatsAppService.sendWhatsAppAndLog(updatedTask.createdById, creatorContact.phoneNumber, creatorText);
      }

      return {
        status: 'success',
        data: {
          task: updatedTask,
          notifications: [
            senderMsg,
            ...(assigneeMsg ? [assigneeMsg] : []),
            ...(creatorMsg ? [creatorMsg] : [])
          ],
        },
      };
    }

    // DELAY - create a delay request for management approval
    if (command.type === 'DELAY') {
      if (!command.delayDate) {
        await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, 'Please specify when you need the delay until (e.g., "delay until Monday" or "extend to next week").');
        return { status: 'error', message: 'No delay date specified.' };
      }

      // Parse the delay date (simple parser for common natural language dates)
      let proposedDueDate: Date | null = null;
      const delayLower = command.delayDate.toLowerCase();
      const now = new Date();
      
      if (/tomorrow/.test(delayLower)) {
        proposedDueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      } else if (/next week/.test(delayLower)) {
        proposedDueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else if (/\d+\s+day/.test(delayLower)) {
        const days = parseInt(delayLower.match(/\d+/)![0]);
        proposedDueDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      } else if (/\d+\s+week/.test(delayLower)) {
        const weeks = parseInt(delayLower.match(/\d+/)![0]);
        proposedDueDate = new Date(now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
      } else if (/\d+\s+month/.test(delayLower)) {
        const months = parseInt(delayLower.match(/\d+/)![0]);
        proposedDueDate = new Date(now.setMonth(now.getMonth() + months));
      } else {
        // Try to parse as a date string
        const parsed = new Date(command.delayDate);
        if (!isNaN(parsed.getTime())) {
          proposedDueDate = parsed;
        }
      }

      if (!proposedDueDate || isNaN(proposedDueDate.getTime())) {
        await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, `Could not understand the date: "${command.delayDate}". Try saying "delay until Monday" or "extend by 3 days".`);
        return { status: 'error', message: 'Invalid date format.' };
      }

      // Create delay request
      const delayRequest = await prisma.delayRequest.create({
        data: {
          taskId: task.id,
          requestedById: sender.id,
          proposedDueDate,
          reason: command.delayReason || 'Requested via WhatsApp',
          status: 'PENDING',
        },
      });

      // Add task comment
      await prisma.taskComment.create({
        data: {
          taskId: task.id,
          userId: sender.id,
          content: `Delay requested until ${proposedDueDate.toISOString().split('T')[0]}: ${command.delayReason || 'Requested via WhatsApp'}`,
        },
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          userId: sender.id,
          action: 'BOT_DELAY_REQUESTED',
          details: `Task "${task.title}" delay requested until ${proposedDueDate.toISOString().split('T')[0]} by ${sender.name}.`,
        },
      });

      // Notify management for approval
      const managers = await prisma.user.findMany({
        where: { role: { in: ['MANAGER', 'FLEET_MANAGER', 'OWNER'] }, isActive: true },
      });

      const approvalText = `⏰ Delay Request from ${sender.name} for task "${task.title}"\nRequested until: ${proposedDueDate.toISOString().split('T')[0]}\nReason: ${command.delayReason || 'N/A'}\n\nReply: APPROVE DELAY ${delayRequest.id} or REJECT DELAY ${delayRequest.id}`;
      
      for (const manager of managers) {
        const managerContact = await prisma.userContact.findFirst({
          where: { userId: manager.id, channel: BotChannel.WHATSAPP },
        });
        if (managerContact?.phoneNumber) {
          await WhatsAppService.sendWhatsAppAndLog(manager.id, managerContact.phoneNumber, approvalText);
        }
      }

      // Send confirmation to sender
      const confirmationText = `Delay request sent for approval. You requested until ${proposedDueDate.toISOString().split('T')[0]}. A manager will review it.`;
      const senderMsg = await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, confirmationText);

      return {
        status: 'success',
        data: {
          delayRequest,
          notifications: [senderMsg],
        },
      };
    }

    // APPROVE_DELAY - approve a delay request (manager/owner only)
    if (command.type === 'APPROVE_DELAY') {
      const isManagement = sender.role === 'OWNER' || sender.role === 'MANAGER' || sender.role === 'FLEET_MANAGER';
      if (!isManagement) {
        await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, 'You do not have permission to approve delay requests.');
        return { status: 'error', message: 'Permission denied.' };
      }
      if (!command.delayRequestId) {
        await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, 'Please specify the delay request ID to approve.');
        return { status: 'error', message: 'No delay request ID specified.' };
      }

      const delayRequest = await prisma.delayRequest.findUnique({
        where: { id: command.delayRequestId },
        include: { task: true, requestedBy: true },
      });
      if (!delayRequest) {
        await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, 'Delay request not found.');
        return { status: 'error', message: 'Delay request not found.' };
      }
      if (delayRequest.status !== 'PENDING') {
        await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, `This delay request is already ${delayRequest.status.toLowerCase()}.`);
        return { status: 'error', message: `Already ${delayRequest.status.toLowerCase()}.` };
      }

      await prisma.delayRequest.update({
        where: { id: command.delayRequestId },
        data: { status: 'APPROVED', approvedById: sender.id, approvedAt: new Date() },
      });
      await prisma.task.update({
        where: { id: delayRequest.taskId },
        data: { dueDate: delayRequest.proposedDueDate },
      });

      await prisma.auditLog.create({
        data: {
          userId: sender.id,
          action: 'BOT_DELAY_APPROVED',
          details: `Delay request ${command.delayRequestId} approved by ${sender.name}.`,
        },
      });

      const requesterContact = await prisma.userContact.findFirst({
        where: { userId: delayRequest.requestedById, channel: BotChannel.WHATSAPP },
      });
      if (requesterContact?.phoneNumber) {
        await WhatsAppService.sendWhatsAppAndLog(
          delayRequest.requestedById,
          requesterContact.phoneNumber,
          `✅ Your delay request for "${delayRequest.task.title}" has been APPROVED. New due date: ${delayRequest.proposedDueDate.toISOString().split('T')[0]}.`
        );
      }

      const confirmationText = `Delay request approved for "${delayRequest.task.title}". New due date: ${delayRequest.proposedDueDate.toISOString().split('T')[0]}.`;
      const senderMsg = await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, confirmationText);
      return { status: 'success', message: confirmationText, outgoing: [senderMsg] };
    }

    // REJECT_DELAY - reject a delay request (manager/owner only)
    if (command.type === 'REJECT_DELAY') {
      const isManagement = sender.role === 'OWNER' || sender.role === 'MANAGER' || sender.role === 'FLEET_MANAGER';
      if (!isManagement) {
        await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, 'You do not have permission to reject delay requests.');
        return { status: 'error', message: 'Permission denied.' };
      }
      if (!command.delayRequestId) {
        await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, 'Please specify the delay request ID to reject.');
        return { status: 'error', message: 'No delay request ID specified.' };
      }

      const delayRequest = await prisma.delayRequest.findUnique({
        where: { id: command.delayRequestId },
        include: { task: true, requestedBy: true },
      });
      if (!delayRequest) {
        await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, 'Delay request not found.');
        return { status: 'error', message: 'Delay request not found.' };
      }
      if (delayRequest.status !== 'PENDING') {
        await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, `This delay request is already ${delayRequest.status.toLowerCase()}.`);
        return { status: 'error', message: `Already ${delayRequest.status.toLowerCase()}.` };
      }

      await prisma.delayRequest.update({
        where: { id: command.delayRequestId },
        data: { status: 'REJECTED', approvedById: sender.id, approvedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          userId: sender.id,
          action: 'BOT_DELAY_REJECTED',
          details: `Delay request ${command.delayRequestId} rejected by ${sender.name}.`,
        },
      });

      const requesterContact = await prisma.userContact.findFirst({
        where: { userId: delayRequest.requestedById, channel: BotChannel.WHATSAPP },
      });
      if (requesterContact?.phoneNumber) {
        await WhatsAppService.sendWhatsAppAndLog(
          delayRequest.requestedById,
          requesterContact.phoneNumber,
          `❌ Your delay request for "${delayRequest.task.title}" has been REJECTED.`
        );
      }

      const confirmationText = `Delay request rejected for "${delayRequest.task.title}".`;
      const senderMsg = await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, confirmationText);
      return { status: 'success', message: confirmationText, outgoing: [senderMsg] };
    }

    // APPROVE_DELAY - approve a delay request (manager/owner only)
    if (command.type === 'APPROVE_DELAY') {
      const isManagement = sender.role === 'OWNER' || sender.role === 'MANAGER' || sender.role === 'FLEET_MANAGER';
      if (!isManagement) {
        await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, 'You do not have permission to approve delay requests.');
        return { status: 'error', message: 'Permission denied.' };
      }
      if (!command.delayRequestId) {
        await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, 'Please specify the delay request ID to approve.');
        return { status: 'error', message: 'No delay request ID specified.' };
      }

      const delayRequest = await prisma.delayRequest.findUnique({
        where: { id: command.delayRequestId },
        include: { task: true, requestedBy: true },
      });
      if (!delayRequest) {
        await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, 'Delay request not found.');
        return { status: 'error', message: 'Delay request not found.' };
      }
      if (delayRequest.status !== 'PENDING') {
        await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, `This delay request is already ${delayRequest.status.toLowerCase()}.`);
        return { status: 'error', message: `Already ${delayRequest.status.toLowerCase()}.` };
      }

      await prisma.delayRequest.update({
        where: { id: command.delayRequestId },
        data: { status: 'APPROVED', approvedById: sender.id, approvedAt: new Date() },
      });
      await prisma.task.update({
        where: { id: delayRequest.taskId },
        data: { dueDate: delayRequest.proposedDueDate },
      });

      await prisma.auditLog.create({
        data: {
          userId: sender.id,
          action: 'BOT_DELAY_APPROVED',
          details: `Delay request ${command.delayRequestId} approved by ${sender.name}.`,
        },
      });

      const requesterContact = await prisma.userContact.findFirst({
        where: { userId: delayRequest.requestedById, channel: BotChannel.WHATSAPP },
      });
      if (requesterContact?.phoneNumber) {
        await WhatsAppService.sendWhatsAppAndLog(
          delayRequest.requestedById,
          requesterContact.phoneNumber,
          `✅ Your delay request for "${delayRequest.task.title}" has been APPROVED. New due date: ${delayRequest.proposedDueDate.toISOString().split('T')[0]}.`
        );
      }

      const confirmationText = `Delay request approved for "${delayRequest.task.title}". New due date: ${delayRequest.proposedDueDate.toISOString().split('T')[0]}.`;
      const senderMsg = await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, confirmationText);
      return { status: 'success', message: confirmationText, outgoing: [senderMsg] };
    }

    // REJECT_DELAY - reject a delay request (manager/owner only)
    if (command.type === 'REJECT_DELAY') {
      const isManagement = sender.role === 'OWNER' || sender.role === 'MANAGER' || sender.role === 'FLEET_MANAGER';
      if (!isManagement) {
        await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, 'You do not have permission to reject delay requests.');
        return { status: 'error', message: 'Permission denied.' };
      }
      if (!command.delayRequestId) {
        await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, 'Please specify the delay request ID to reject.');
        return { status: 'error', message: 'No delay request ID specified.' };
      }

      const delayRequest = await prisma.delayRequest.findUnique({
        where: { id: command.delayRequestId },
        include: { task: true, requestedBy: true },
      });
      if (!delayRequest) {
        await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, 'Delay request not found.');
        return { status: 'error', message: 'Delay request not found.' };
      }
      if (delayRequest.status !== 'PENDING') {
        await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, `This delay request is already ${delayRequest.status.toLowerCase()}.`);
        return { status: 'error', message: `Already ${delayRequest.status.toLowerCase()}.` };
      }

      await prisma.delayRequest.update({
        where: { id: command.delayRequestId },
        data: { status: 'REJECTED', approvedById: sender.id, approvedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          userId: sender.id,
          action: 'BOT_DELAY_REJECTED',
          details: `Delay request ${command.delayRequestId} rejected by ${sender.name}.`,
        },
      });

      const requesterContact = await prisma.userContact.findFirst({
        where: { userId: delayRequest.requestedById, channel: BotChannel.WHATSAPP },
      });
      if (requesterContact?.phoneNumber) {
        await WhatsAppService.sendWhatsAppAndLog(
          delayRequest.requestedById,
          requesterContact.phoneNumber,
          `❌ Your delay request for "${delayRequest.task.title}" has been REJECTED.`
        );
      }

      const confirmationText = `Delay request rejected for "${delayRequest.task.title}".`;
      const senderMsg = await WhatsAppService.sendWhatsAppAndLog(sender.id, fromPhone, confirmationText);
      return { status: 'success', message: confirmationText, outgoing: [senderMsg] };
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

    // Else find active tasks assigned to the user
    const activeTasks = await prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: { not: 'COMPLETED' },
        isDeleted: false,
        deletedAt: null,
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
