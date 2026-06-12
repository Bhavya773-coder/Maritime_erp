import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BotService } from './bot.service';

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
