import prisma from '../../config/db';
import { env } from '../../config/env';
import { BotService } from './bot.service';
import { BotChannel } from '@prisma/client';
import { BotReplyParser } from './bot.reply-parser';
import { BotReplyService } from './bot.reply-service';
import { BotFleetParser } from './bot.fleet-parser';
import { BotFleetService } from './bot.fleet-service';

export class WhatsAppService {
  /**
   * Normalize phone number to contain only digits
   */
  public static normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  /**
   * Send WhatsApp text message using Cloud API
   */
  public static async sendWhatsAppText(toPhone: string, message: string): Promise<any> {
    const cleanPhone = this.normalizePhone(toPhone);
    
    if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
      console.log(`[SIMULATED WHATSAPP MESSAGE] To: ${cleanPhone}, Content: ${message}`);
      return { status: 'SIMULATED', to: cleanPhone, body: message };
    }

    const url = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'text',
          text: { body: message },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[WhatsApp API Error] HTTP ${response.status}: ${errorText}`);
        throw new Error(`WhatsApp API error: ${errorText}`);
      }

      return await response.json();
    } catch (err: any) {
      console.error('[WhatsApp Service Exception]', err);
      // Do not crash, log and return simulated response to avoid failing webhooks
      return { status: 'FAILED_SEND_FALLBACK_SIMULATED', error: err.message };
    }
  }

  /**
   * Send WhatsApp text message and log as outgoing BotMessage
   */
  public static async sendWhatsAppAndLog(
    toUserId: string | null,
    toPhone: string,
    messageText: string
  ): Promise<any> {
    const cleanPhone = this.normalizePhone(toPhone);
    const isSimulated = !env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID;
    
    await this.sendWhatsAppText(cleanPhone, messageText);
    
    const status = isSimulated ? 'SIMULATED' : 'SENT';
    
    return await prisma.botMessage.create({
      data: {
        direction: 'OUTGOING',
        channel: BotChannel.WHATSAPP,
        toUserId,
        toPhone: cleanPhone,
        rawText: messageText,
        messageType: 'TEXT',
        status,
      },
    });
  }

  /**
   * Meta Webhook verification
   */
  public static verifyWebhook(mode: string, verifyToken: string, challenge: string): string | null {
    if (mode === 'subscribe' && verifyToken === env.WHATSAPP_VERIFY_TOKEN) {
      return challenge;
    }
    return null;
  }

  /**
   * Process webhook entry payload
   */
  public static async handleIncomingWebhook(payload: any): Promise<void> {
    if (payload.object === 'whatsapp_business_account' && payload.entry) {
      for (const entry of payload.entry) {
        if (entry.changes) {
          for (const change of entry.changes) {
            const value = change.value;
            if (value && value.messages) {
              for (const msg of value.messages) {
                if (msg.type === 'text' && msg.text && msg.text.body) {
                  const fromPhone = msg.from;
                  const messageId = msg.id;
                  const textBody = msg.text.body;

                  await this.processIncomingMessage(fromPhone, textBody, messageId);
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * Core logic for processing an incoming WhatsApp message
   */
  public static async processIncomingMessage(
    fromPhone: string,
    textBody: string,
    providerMessageId: string
  ): Promise<any> {
    const cleanPhone = this.normalizePhone(fromPhone);

    // Find contact mapping
    const contact = await prisma.userContact.findFirst({
      where: {
        phoneNumber: cleanPhone,
        channel: BotChannel.WHATSAPP,
      },
      include: {
        user: true,
      },
    });
    const owner = await prisma.user.findFirst({
      where: { email: 'owner@apil.local' },
    });

    const senderUser = contact
      ? contact.user
      : {
          ...owner!,
          name: `Unregistered (${cleanPhone})`,
        };

    // Check if it is a reply command
    const replyCommand = BotReplyParser.parse(textBody);
    if (replyCommand) {
      // 1. Log incoming BotMessage
      await prisma.botMessage.create({
        data: {
          direction: 'INCOMING',
          channel: BotChannel.WHATSAPP,
          fromUserId: senderUser.id,
          fromPhone: cleanPhone,
          rawText: textBody,
          messageType: 'TEXT',
          status: 'RECEIVED',
          providerMessageId,
        },
      });

      return await BotReplyService.executeReplyCommand(
        senderUser,
        replyCommand,
        cleanPhone,
        providerMessageId
      );
    }

    // Check if it is a fleet info query
    const fleetQuery = BotFleetParser.parse(textBody);
    if (fleetQuery) {
      // Log incoming BotMessage
      await prisma.botMessage.create({
        data: {
          direction: 'INCOMING',
          channel: BotChannel.WHATSAPP,
          fromUserId: senderUser.id,
          fromPhone: cleanPhone,
          rawText: textBody,
          messageType: 'TEXT',
          status: 'RECEIVED',
          providerMessageId,
        },
      });

      const replyText = await BotFleetService.executeQuery(fleetQuery);
      
      // Send response and log outgoing BotMessage
      const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);

      return {
        status: 'success',
        message: replyText,
        outgoing: [outgoing],
      };
    }

    // Call processCommand in Bot Core
    const result = await BotService.processCommand(textBody, senderUser, {
      channel: BotChannel.WHATSAPP,
      fromPhone: cleanPhone,
      providerMessageId,
    });

    if (result.status === 'success' && result.data) {
      // Dispatch real/simulated notifications generated by Bot Core
      const notifications = result.data.notifications;
      for (const n of notifications) {
        if (n.toPhone) {
          await this.sendWhatsAppText(n.toPhone, n.rawText);
        }
      }
      return result;
    } else {
      // NEEDS_CONFIRMATION or FAILED
      const replyText = result.message || 'Command execution failed.';
      
      // Send WhatsApp message
      await this.sendWhatsAppText(cleanPhone, replyText);

      // Log outgoing BotMessage
      const outgoing = await prisma.botMessage.create({
        data: {
          direction: 'OUTGOING',
          channel: BotChannel.WHATSAPP,
          toUserId: senderUser.id,
          toPhone: cleanPhone,
          rawText: replyText,
          messageType: 'TEXT',
          status: 'SENT',
        },
      });

      return {
        status: result.status,
        message: replyText,
        command: result.command,
        options: result.options,
        outgoing: [outgoing],
      };
    }
  }
}
