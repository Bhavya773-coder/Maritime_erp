import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BotService } from './bot.service';
import { BotReminderService } from './bot.reminder-service';
import { BotPersonalReminderService } from './bot.personal-reminder-service';

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
