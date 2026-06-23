import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BotService } from './bot.service';
import { BotReminderService } from './bot.reminder-service';
import { BotPersonalReminderService } from './bot.personal-reminder-service';
import { WhatsAppService } from './whatsapp.service';
import prisma from '../../config/db';
import { BotChannel } from '@prisma/client';
import { AppError } from '../../middleware/error';

export const testCommand = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    const result = await BotService.processCommand(message, req.user!);
    
    if (result.status === 'success') {
      return res.status(201).json(result);
    } else {
      return res.status(200).json(result);
    }
  } catch (error) {
    next(error);
  }
};

export const getMessages = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const messages = await BotService.getMessages();
    return res.status(200).json({
      status: 'success',
      data: { messages },
    });
  } catch (error) {
    next(error);
  }
};

export const getReminders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const reminders = await BotService.getReminders();
    return res.status(200).json({
      status: 'success',
      data: { reminders },
    });
  } catch (error) {
    next(error);
  }
};

export const pauseReminder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const reminder = await BotService.pauseReminder(id);
    return res.status(200).json({
      status: 'success',
      data: { reminder },
    });
  } catch (error) {
    next(error);
  }
};

export const processDueReminders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const stats = await BotReminderService.processDueReminders();
    return res.status(200).json({
      status: 'success',
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Personal Reminder Controllers ───────────────────────────────────────────

export const createPersonalReminder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { title, description, remindAt } = req.body;
    const reminder = await BotPersonalReminderService.createPersonalReminder(
      req.user!.id,
      title,
      description || null,
      new Date(remindAt)
    );
    return res.status(201).json({
      status: 'success',
      data: { reminder },
    });
  } catch (error) {
    next(error);
  }
};

export const getPersonalReminders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const reminders = await BotPersonalReminderService.getPersonalReminders(req.user!.id);
    return res.status(200).json({
      status: 'success',
      data: { reminders },
    });
  } catch (error) {
    next(error);
  }
};

export const cancelPersonalReminder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const reminder = await BotPersonalReminderService.cancelPersonalReminder(id, req.user!.id);
    return res.status(200).json({
      status: 'success',
      data: { reminder },
    });
  } catch (error) {
    next(error);
  }
};

export const processDuePersonalReminders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const stats = await BotPersonalReminderService.processDuePersonalReminders();
    return res.status(200).json({
      status: 'success',
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Delay Request Controllers ───────────────────────────────────────────────

export const getDelayRequests = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query as { status?: string };
    const where: any = {};
    if (status) where.status = status;
    
    const delayRequests = await prisma.delayRequest.findMany({
      where,
      include: {
        task: { select: { id: true, title: true, status: true } },
        requestedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      status: 'success',
      data: { delayRequests },
    });
  } catch (error) {
    next(error);
  }
};

export const approveDelayRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const approverId = req.user!.id;

    const delayRequest = await prisma.delayRequest.findUnique({
      where: { id },
      include: {
        task: { include: { creator: true, assignee: true } },
        requestedBy: true,
      },
    });

    if (!delayRequest) {
      throw new AppError('Delay request not found', 404);
    }
    if (delayRequest.status !== 'PENDING') {
      throw new AppError(`Delay request is already ${delayRequest.status.toLowerCase()}`, 400);
    }

    const updatedDelayRequest = await prisma.delayRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: approverId,
        approvedAt: new Date(),
      },
    });

    // Update task due date
    await prisma.task.update({
      where: { id: delayRequest.taskId },
      data: { dueDate: delayRequest.proposedDueDate },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: approverId,
        action: 'DELAY_REQUEST_APPROVED',
        details: `Delay request for task "${delayRequest.task.title}" approved. New due date: ${delayRequest.proposedDueDate.toISOString().split('T')[0]}`,
      },
    });

    // Notify requester
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

    return res.status(200).json({
      status: 'success',
      data: { delayRequest: updatedDelayRequest },
    });
  } catch (error) {
    next(error);
  }
};

export const rejectDelayRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const approverId = req.user!.id;

    const delayRequest = await prisma.delayRequest.findUnique({
      where: { id },
      include: {
        task: { include: { creator: true, assignee: true } },
        requestedBy: true,
      },
    });

    if (!delayRequest) {
      throw new AppError('Delay request not found', 404);
    }
    if (delayRequest.status !== 'PENDING') {
      throw new AppError(`Delay request is already ${delayRequest.status.toLowerCase()}`, 400);
    }

    const updatedDelayRequest = await prisma.delayRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedById: approverId,
        approvedAt: new Date(),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: approverId,
        action: 'DELAY_REQUEST_REJECTED',
        details: `Delay request for task "${delayRequest.task.title}" rejected. Reason: ${reason || 'N/A'}`,
      },
    });

    // Notify requester
    const requesterContact = await prisma.userContact.findFirst({
      where: { userId: delayRequest.requestedById, channel: BotChannel.WHATSAPP },
    });
    if (requesterContact?.phoneNumber) {
      await WhatsAppService.sendWhatsAppAndLog(
        delayRequest.requestedById,
        requesterContact.phoneNumber,
        `❌ Your delay request for "${delayRequest.task.title}" has been REJECTED. ${reason ? `Reason: ${reason}` : ''}`
      );
    }

    return res.status(200).json({
      status: 'success',
      data: { delayRequest: updatedDelayRequest },
    });
  } catch (error) {
    next(error);
  }
};
