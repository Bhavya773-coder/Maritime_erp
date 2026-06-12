import prisma from '../../config/db';
import { AppError } from '../../middleware/error';
import { Role, BotChannel, BotMessageDirection, BotCommandStatus, BotReminderStatus } from '@prisma/client';
import { BotParser } from './bot.parser';

export class BotService {
  /**
   * Process a text command from a user
   */
  public static async processCommand(
    messageText: string,
    sender: { id: string; role: Role; name: string }
  ) {
    // 1. Store incoming BotMessage
    const incomingMessage = await prisma.botMessage.create({
      data: {
        direction: 'INCOMING',
        channel: 'INTERNAL_TEST',
        fromUserId: sender.id,
        rawText: messageText,
        messageType: 'TEXT',
        status: 'RECEIVED',
      },
    });

    // Audit log: Bot command received
    await prisma.auditLog.create({
      data: {
        userId: sender.id,
        action: 'BOT_COMMAND_RECEIVED',
        details: `Bot command received: "${messageText}"`,
      },
    });

    // 2. Parse command
    const parsed = BotParser.parse(messageText);

    // 3. Resolve assignee
    if (!parsed.assigneeName) {
      const command = await prisma.botCommand.create({
        data: {
          botMessageId: incomingMessage.id,
          intent: parsed.intent,
          confidence: 0.5,
          parsedJson: parsed as any,
          status: 'NEEDS_CONFIRMATION',
        },
      });

      return {
        status: 'NEEDS_CONFIRMATION',
        message: 'No assignee could be extracted from command. Please specify an assignee.',
        command,
        options: [],
      };
    }

    const activeUsers = await prisma.user.findMany({
      where: { isActive: true },
    });

    const queryLower = parsed.assigneeName.toLowerCase();
    
    // Check if matching department
    const matchesDept = (deptName: string) => {
      const d = deptName.toLowerCase();
      return d === queryLower || d + 's' === queryLower || queryLower + 's' === d;
    };

    let candidates = activeUsers.filter(u => u.department && matchesDept(u.department));

    // If no department matched, match by name tokens
    if (candidates.length === 0) {
      const queryTokens = queryLower.split(/\s+/).filter(Boolean);
      candidates = activeUsers.filter(user => {
        const userLower = user.name.toLowerCase();
        const userTokens = userLower.split(/\s+/).filter(Boolean);
        
        // All query tokens must prefix-match some token in the user's name
        return queryTokens.every(qToken => 
          userTokens.some(uToken => uToken.startsWith(qToken))
        );
      });
    }

    // 4. Resolve flow outcomes
    // Case A: No matches
    if (candidates.length === 0) {
      const command = await prisma.botCommand.create({
        data: {
          botMessageId: incomingMessage.id,
          intent: parsed.intent,
          confidence: 0.0,
          parsedJson: parsed as any,
          status: 'NEEDS_CONFIRMATION',
        },
      });

      return {
        status: 'NEEDS_CONFIRMATION',
        message: `Could not resolve assignee "${parsed.assigneeName}". No active user or department matched.`,
        command,
        options: [],
      };
    }

    // Case B: Multiple matches
    if (candidates.length > 1) {
      const command = await prisma.botCommand.create({
        data: {
          botMessageId: incomingMessage.id,
          intent: parsed.intent,
          confidence: 0.5,
          parsedJson: parsed as any,
          status: 'NEEDS_CONFIRMATION',
        },
      });

      return {
        status: 'NEEDS_CONFIRMATION',
        message: `Multiple matches found for "${parsed.assigneeName}". Please select the correct assignee.`,
        command,
        options: candidates.map(c => ({ id: c.id, name: c.name, department: c.department })),
      };
    }

    // Case C: Exactly one match -> execute
    const assignee = candidates[0];
    const dueDate = parsed.dueDate || new Date(Date.now() + 24 * 60 * 60 * 1000); // Default to tomorrow if not found

    // Create task
    const task = await prisma.task.create({
      data: {
        title: parsed.taskTitle,
        description: `Created via bot command. Original text: "${messageText}"`,
        taskType: 'ASSIGNED',
        createdById: sender.id,
        assignedToId: assignee.id,
        dueDate,
        priority: parsed.priority,
        status: 'PENDING',
      },
      include: {
        creator: { select: { id: true, name: true, email: true, role: true } },
        assignee: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    // Create initial task delegation log
    await prisma.taskDelegationLog.create({
      data: {
        taskId: task.id,
        fromUserId: sender.id,
        toUserId: assignee.id,
        note: 'Initial assignment via bot command',
      },
    });

    // Audit log: Bot task created
    await prisma.auditLog.create({
      data: {
        userId: sender.id,
        action: 'BOT_TASK_CREATED',
        details: `Task "${task.title}" (ID: ${task.id}) created via bot command for assignee ${assignee.name}.`,
      },
    });

    // Create BotCommand record
    const command = await prisma.botCommand.create({
      data: {
        botMessageId: incomingMessage.id,
        intent: parsed.intent,
        confidence: 1.0,
        parsedJson: parsed as any,
        linkedTaskId: task.id,
        status: 'EXECUTED',
      },
    });

    // Calculate intelligent reminder time
    const now = new Date();
    let nextReminderAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    if (parsed.dueDate) {
      const dueTime = parsed.dueDate.getTime();
      const reminderTime = dueTime - 24 * 60 * 60 * 1000;
      if (reminderTime > now.getTime()) {
        nextReminderAt = new Date(reminderTime);
      } else {
        // If due date is within 24 hours, remind at the due date itself
        nextReminderAt = parsed.dueDate;
      }
    }

    // Create BotReminder
    const reminder = await prisma.botReminder.create({
      data: {
        taskId: task.id,
        assignedToId: assignee.id,
        reminderType: 'TASK_PENDING',
        frequencyHours: 24,
        nextReminderAt,
        status: 'ACTIVE',
      },
    });

    // Audit log: Bot reminder created
    await prisma.auditLog.create({
      data: {
        userId: sender.id,
        action: 'BOT_REMINDER_CREATED',
        details: `Reminder (ID: ${reminder.id}) created for task "${task.title}" to run at ${nextReminderAt.toISOString()}.`,
      },
    });

    // Create outgoing bot messages
    const assigneeMsg = await prisma.botMessage.create({
      data: {
        direction: 'OUTGOING',
        channel: 'INTERNAL_TEST',
        toUserId: assignee.id,
        rawText: `New task assigned to you: "${task.title}". Priority: ${task.priority}. Due: ${task.dueDate.toISOString()}.`,
        messageType: 'TEXT',
        status: 'SENT',
      },
    });

    const senderMsg = await prisma.botMessage.create({
      data: {
        direction: 'OUTGOING',
        channel: 'INTERNAL_TEST',
        toUserId: sender.id,
        rawText: `Task created: "${task.title}" has been assigned to ${assignee.name}.`,
        messageType: 'TEXT',
        status: 'SENT',
      },
    });

    return {
      status: 'success',
      data: {
        command,
        task,
        notifications: [assigneeMsg, senderMsg],
      },
    };
  }

  /**
   * Retrieve bot messages (OWNER only)
   */
  public static async getMessages() {
    return prisma.botMessage.findMany({
      include: {
        fromUser: { select: { id: true, name: true, email: true, role: true } },
        toUser: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Retrieve bot reminders (OWNER/MANAGER only)
   */
  public static async getReminders() {
    return prisma.botReminder.findMany({
      include: {
        task: { select: { id: true, title: true, status: true, dueDate: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Pause a reminder by ID (OWNER/MANAGER only)
   */
  public static async pauseReminder(id: string) {
    const reminder = await prisma.botReminder.findUnique({
      where: { id },
    });

    if (!reminder) {
      throw new AppError('Reminder not found', 404);
    }

    return prisma.botReminder.update({
      where: { id },
      data: { status: 'PAUSED' },
      include: {
        task: { select: { id: true, title: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });
  }
}
