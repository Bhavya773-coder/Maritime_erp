import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { WhatsAppService } from './whatsapp.service';
import prisma from '../../config/db';
import { AppError } from '../../middleware/error';

export const verifyWebhook = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    const result = WhatsAppService.verifyWebhook(mode, token, challenge);
    
    if (result !== null) {
      return res.status(200).setHeader('Content-Type', 'text/plain').send(result);
    }
    
    return res.status(403).json({ status: 'error', message: 'Forbidden' });
  } catch (error) {
    next(error);
  }
};

export const receiveWebhook = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await WhatsAppService.handleIncomingWebhook(req.body);
    return res.status(200).json({ status: 'success' });
  } catch (error) {
    next(error);
  }
};

export const testWebhook = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { fromPhone, message } = req.body;
    
    if (!fromPhone || !message) {
      throw new AppError('fromPhone and message are required fields', 400);
    }

    const result = await WhatsAppService.processIncomingMessage(fromPhone, message, 'simulated-msg-id');
    
    const statusCode = result.status === 'success' ? 201 : 200;
    return res.status(statusCode).json(result);
  } catch (error) {
    next(error);
  }
};

export const createContact = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId, phoneNumber, channel, isVerified } = req.body;

    if (!userId || !phoneNumber || !channel) {
      throw new AppError('userId, phoneNumber, and channel are required fields', 400);
    }

    const userExists = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userExists) {
      throw new AppError('User not found', 404);
    }

    const cleanPhone = WhatsAppService.normalizePhone(phoneNumber);

    const contact = await prisma.userContact.upsert({
      where: {
        userId_phoneNumber_channel: {
          userId,
          phoneNumber: cleanPhone,
          channel,
        },
      },
      update: {
        isVerified: isVerified !== undefined ? isVerified : false,
      },
      create: {
        userId,
        phoneNumber: cleanPhone,
        channel,
        isVerified: isVerified !== undefined ? isVerified : false,
      },
    });

    return res.status(201).json({
      status: 'success',
      data: { contact },
    });
  } catch (error) {
    next(error);
  }
};

export const getContacts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contacts = await prisma.userContact.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      status: 'success',
      data: { contacts },
    });
  } catch (error) {
    next(error);
  }
};
