import prisma from '../../config/db';
import { AppError } from '../../middleware/error';
import { Role, BotChannel, BotMessageDirection, BotCommandStatus, BotReminderStatus } from '@prisma/client';
import { BotParser } from './bot.parser';
import { LlmService } from './llm.service';
import { BotNotificationService } from './bot.notification-service';
import { calculateNextReminderAt } from './bot.utils';

export class BotService {
  /**
   * Process a text command from a user
   */
  public static async processCommand(
    messageText: string,
    sender: { id: string; role: Role; name: string },
    options?: {
      channel?: BotChannel;
      fromPhone?: string;
      providerMessageId?: string;
    }
  ) {
    const channel = options?.channel || BotChannel.INTERNAL_TEST;
    const fromPhone = options?.fromPhone || null;
    const providerMessageId = options?.providerMessageId || null;

    // 1. Store incoming BotMessage
    const incomingMessage = await prisma.botMessage.create({
      data: {
        direction: 'INCOMING',
        channel,
        fromUserId: sender.id,
        fromPhone,
        rawText: messageText,
        messageType: 'TEXT',
        status: 'RECEIVED',
        providerMessageId,
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

    // 2. Process via LLM agent loop
    try {
      const translation = await LlmService.translateMessage(
        messageText,
        sender.id,
        sender.name,
        sender.role
      );

      // Update incoming message status to EXECUTED
      const updatedMessage = await prisma.botMessage.update({
        where: { id: incomingMessage.id },
        data: { status: 'EXECUTED' },
      });

      return {
        status: translation.status || 'success',
        message: translation.directResponse || "I have processed your request.",
        options: translation.options || [],
        data: {
          task: translation.task || null,
          command: updatedMessage,
          notifications: translation.notifications || [],
        },
      };
    } catch (err: any) {
      console.error('[BotService] Error in LLM agent loop:', err);
      return {
        status: 'failed',
        message: `Error processing request: ${err.message}`,
      };
    }
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

  /**
   * Resolve assignee candidates by name/department
   */
  public static async resolveAssignee(assigneeName: string) {
    const activeUsers = await prisma.user.findMany({
      where: { isActive: true },
    });

    const queryLower = assigneeName.toLowerCase().trim();
    
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

    return candidates;
  }
}
