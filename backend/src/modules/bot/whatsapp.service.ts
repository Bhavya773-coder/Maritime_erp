import prisma from '../../config/db';
import { env } from '../../config/env';
import { BotService } from './bot.service';
import { BotChannel, Role } from '@prisma/client';
import { BotReplyParser } from './bot.reply-parser';
import { BotStaffService } from './bot.staff-service';
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
    
    const maxLen = 4000;
    if (message.length <= maxLen) {
      return this.dispatchSingleMessage(url, cleanPhone, message);
    } else {
      const chunks: string[] = [];
      let remaining = message;
      while (remaining.length > 0) {
        if (remaining.length <= maxLen) {
          chunks.push(remaining);
          break;
        }
        let splitIdx = remaining.lastIndexOf('\n', maxLen);
        if (splitIdx === -1 || splitIdx < maxLen / 2) {
          splitIdx = maxLen;
        }
        chunks.push(remaining.substring(0, splitIdx).trim());
        remaining = remaining.substring(splitIdx).trim();
      }

      console.log(`[WhatsApp Service] Message too long (${message.length} chars). Splitting into ${chunks.length} chunks.`);
      let lastRes: any = null;
      for (const chunk of chunks) {
        lastRes = await this.dispatchSingleMessage(url, cleanPhone, chunk);
        // Add a slight delay to preserve delivery order on device
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      return lastRes;
    }
  }

  private static async dispatchSingleMessage(url: string, cleanPhone: string, message: string): Promise<any> {
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
      return { status: 'FAILED_SEND_FALLBACK_SIMULATED', error: err.message };
    }
  }

  /**
   * Send WhatsApp template message using Cloud API
   */
  public static async sendWhatsAppTemplate(
    toPhone: string,
    templateName: string,
    languageCode: string,
    parameters: string[]
  ): Promise<any> {
    const cleanPhone = this.normalizePhone(toPhone);
    
    if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
      console.log(`[SIMULATED WHATSAPP TEMPLATE] To: ${cleanPhone}, Template: ${templateName}, Params: ${JSON.stringify(parameters)}`);
      return { status: 'SIMULATED_TEMPLATE', to: cleanPhone, template: templateName, parameters };
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
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: languageCode
            },
            components: [
              {
                type: 'body',
                parameters: parameters.map(p => ({
                  type: 'text',
                  text: p
                }))
              }
            ]
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[WhatsApp API Template Error] HTTP ${response.status}: ${errorText}`);
        throw new Error(`WhatsApp API template error: ${errorText}`);
      }

      return await response.json();
    } catch (err: any) {
      console.error('[WhatsApp Service Template Exception]', err);
      return { status: 'FAILED_SEND_FALLBACK_SIMULATED', error: err.message };
    }
  }

  /**
   * Send WhatsApp text message (or template) and log as outgoing BotMessage
   */
  public static async sendWhatsAppAndLog(
    toUserId: string | null,
    toPhone: string,
    messageText: string
  ): Promise<any> {
    const cleanPhone = this.normalizePhone(toPhone);
    const isSimulated = !env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID;

    // Check if the outgoing message is a task assignment or delegation, and if we should use templates
    let type = 'TEXT';
    if (env.WHATSAPP_TEMPLATE_NAME) {
      // 1. Check if it's a direct task assignment
      // e.g. "New task from Bhavya: Check progress of KB 26 repairing. Reply UPDATE, DONE, or DELEGATE."
      const taskAssignMatch = messageText.match(/^New task from (.+?): (.+?)\. Reply UPDATE, DONE, or DELEGATE\.$/);
      if (taskAssignMatch) {
        const senderName = taskAssignMatch[1];
        const taskTitle = taskAssignMatch[2];
        type = 'TEMPLATE';
        await this.sendWhatsAppTemplate(
          cleanPhone,
          env.WHATSAPP_TEMPLATE_NAME,
          env.WHATSAPP_TEMPLATE_LANG || 'en',
          [senderName, taskTitle]
        );
      } else {
        // 2. Check if it's a task delegation
        // e.g. "New task delegated to you by Hardik Kateshiya: Check progress of KB 26. Note: urgent repair needed"
        const taskDelegateMatch = messageText.match(/^New task delegated to you by (.+?): (.+?)\. Note: (.+)$/);
        if (taskDelegateMatch) {
          const senderName = `${taskDelegateMatch[1]} (Delegated)`;
          const taskTitle = `${taskDelegateMatch[2]} (Note: ${taskDelegateMatch[3]})`;
          type = 'TEMPLATE';
          await this.sendWhatsAppTemplate(
            cleanPhone,
            env.WHATSAPP_TEMPLATE_NAME,
            env.WHATSAPP_TEMPLATE_LANG || 'en',
            [senderName, taskTitle]
          );
        } else {
          await this.sendWhatsAppText(cleanPhone, messageText);
        }
      }
    } else {
      await this.sendWhatsAppText(cleanPhone, messageText);
    }
    
    const status = isSimulated ? 'SIMULATED' : 'SENT';
    
    return await prisma.botMessage.create({
      data: {
        direction: 'OUTGOING',
        channel: BotChannel.WHATSAPP,
        toUserId,
        toPhone: cleanPhone,
        rawText: messageText,
        messageType: type,
        status,
      },
    });
  }

  /**
   * Send WhatsApp interactive buttons message using Cloud API
   */
  public static async sendWhatsAppButtons(
    toPhone: string, 
    bodyText: string, 
    buttons: Array<{ id: string; title: string }>
  ): Promise<any> {
    const cleanPhone = this.normalizePhone(toPhone);
    
    if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
      console.log(`[SIMULATED WHATSAPP BUTTONS] To: ${cleanPhone}, Body: ${bodyText}, Buttons: ${JSON.stringify(buttons)}`);
      return { status: 'SIMULATED_BUTTONS', to: cleanPhone, body: bodyText, buttons };
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
          type: 'interactive',
          interactive: {
            type: 'button',
            body: {
              text: bodyText
            },
            action: {
              buttons: buttons.map(b => ({
                type: 'reply',
                reply: {
                  id: b.id,
                  title: b.title
                }
              }))
            }
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[WhatsApp API Button Error] HTTP ${response.status}: ${errorText}`);
        throw new Error(`WhatsApp API error: ${errorText}`);
      }

      return await response.json();
    } catch (err: any) {
      console.error('[WhatsApp Service Button Exception]', err);
      return { status: 'FAILED_SEND_FALLBACK_SIMULATED', error: err.message };
    }
  }

  /**
   * Send WhatsApp buttons message and log as outgoing BotMessage
   */
  public static async sendWhatsAppButtonsAndLog(
    toUserId: string | null,
    toPhone: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>
  ): Promise<any> {
    const cleanPhone = this.normalizePhone(toPhone);
    const isSimulated = !env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID;
    
    await this.sendWhatsAppButtons(cleanPhone, bodyText, buttons);
    
    const status = isSimulated ? 'SIMULATED' : 'SENT';
    const logText = `${bodyText}\n[Buttons: ${buttons.map(b => b.title).join(' | ')}]`;
    
    return await prisma.botMessage.create({
      data: {
        direction: 'OUTGOING',
        channel: BotChannel.WHATSAPP,
        toUserId,
        toPhone: cleanPhone,
        rawText: logText,
        messageType: 'INTERACTIVE_BUTTON',
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
                let textBody = '';
                const fromPhone = msg.from;
                const messageId = msg.id;

                if (msg.type === 'text' && msg.text && msg.text.body) {
                  textBody = msg.text.body;
                } else if (msg.type === 'interactive' && msg.interactive) {
                  if (msg.interactive.button_reply && msg.interactive.button_reply.title) {
                    textBody = msg.interactive.button_reply.title;
                  } else if (msg.interactive.list_reply && msg.interactive.list_reply.title) {
                    textBody = msg.interactive.list_reply.title;
                  }
                }

                if (textBody) {
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

    // Check if it is a menu/buttons/start/hi/hello/hey command
    const cleanMsg = textBody.trim().toLowerCase();
    if (cleanMsg === 'menu' || cleanMsg === 'buttons' || cleanMsg === 'start' || cleanMsg === 'hi' || cleanMsg === 'hello' || cleanMsg === 'hey') {
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

      const bodyText = `Welcome to Arvind Port & Infra Limited Bot Menu.\nPlease select an option below:`;
      const buttons = [
        { id: 'btn_show_barges', title: 'Show all barges' },
        { id: 'btn_show_tugs', title: 'Show all tugs' },
        { id: 'btn_status', title: 'STATUS' }
      ];

      const outgoing = await this.sendWhatsAppButtonsAndLog(senderUser.id, cleanPhone, bodyText, buttons);

      return {
        status: 'success',
        message: bodyText,
        outgoing: [outgoing],
      };
    }

    // Check if it is an ADD STAFF command
    const addStaffMatch = textBody.trim().match(/^add\s+staff\s+(.+?)\s+(\+?\d[\d\s-]+)\s+(.+)$/i);
    if (addStaffMatch) {
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

      // 2. Authorization check: must be registered, verified OWNER or MANAGER
      if (!contact || !contact.isVerified || (contact.user.role !== Role.OWNER && contact.user.role !== Role.MANAGER)) {
        const replyText = 'Error: Unauthorized. Only registered and verified Owners or Managers can add staff.';
        const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
        return {
          status: 'failed',
          message: replyText,
          outgoing: [outgoing],
        };
      }

      // 3. Process
      const name = addStaffMatch[1].trim();
      const phone = addStaffMatch[2].trim();
      const position = addStaffMatch[3].trim();
      const replyText = await BotStaffService.addStaff(senderUser.id, name, phone, position);
      const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
      return {
        status: 'success',
        message: replyText,
        outgoing: [outgoing],
      };
    }

    // Check if it is a STAFF LIST command
    const isStaffListQuery = /^(?:staff\s+list|list\s+staff|show\s+all\s+staff|show\s+staff|how\s+many\s+members(?:\s+do\s+(?:i|we)\s+have)?)$/i.test(cleanMsg);
    if (isStaffListQuery) {
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

      // 2. Authorization check: must be registered and verified user
      if (!contact || !contact.isVerified) {
        const replyText = 'Error: Unauthorized. Only registered and verified users can view the staff list.';
        const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
        return {
          status: 'failed',
          message: replyText,
          outgoing: [outgoing],
        };
      }

      // 3. Process
      const replyText = await BotStaffService.listStaff();
      const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
      return {
        status: 'success',
        message: replyText,
        outgoing: [outgoing],
      };
    }

    // Check if it is an AG STAFF LIST command
    const isAGStaffListQuery = /^(?:list\s+ag\s+staff|ag\s+staff)$/i.test(cleanMsg);
    if (isAGStaffListQuery) {
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

      // 2. Authorization check: must be registered and verified user
      if (!contact || !contact.isVerified) {
        const replyText = 'Error: Unauthorized. Only registered and verified users can view the AG staff list.';
        const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
        return {
          status: 'failed',
          message: replyText,
          outgoing: [outgoing],
        };
      }

      // 3. Process
      const replyText = await BotStaffService.listAGStaff();
      const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
      return {
        status: 'success',
        message: replyText,
        outgoing: [outgoing],
      };
    }

    // Check if it is an OWNERS LIST command
    const isOwnersListQuery = /^(?:owners|list\s+owners)$/i.test(cleanMsg);
    if (isOwnersListQuery) {
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

      // 2. Authorization check: must be registered and verified user
      if (!contact || !contact.isVerified) {
        const replyText = 'Error: Unauthorized. Only registered and verified users can view the owners list.';
        const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
        return {
          status: 'failed',
          message: replyText,
          outgoing: [outgoing],
        };
      }

      // 3. Process
      const replyText = await BotStaffService.listOwners();
      const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
      return {
        status: 'success',
        message: replyText,
        outgoing: [outgoing],
      };
    }

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

      const replyText = await BotFleetService.executeQuery(fleetQuery, senderUser.id);
      
      // Send response and log outgoing BotMessage
      const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);

      return {
        status: 'success',
        message: replyText,
        outgoing: [outgoing],
      };
    }

    // Log incoming BotMessage for core commands
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

    // Call processCommand in Bot Core
    const result = await BotService.processCommand(textBody, senderUser, {
      channel: BotChannel.WHATSAPP,
      fromPhone: cleanPhone,
      providerMessageId,
    });

    if (result.status === 'success' && result.data) {
      // Dispatch and log notifications generated by Bot Core
      const notifications = result.data.notifications;
      const outgoingMessages: any[] = [];
      for (const n of notifications) {
        if (n.toPhone) {
          const cleanToPhone = this.normalizePhone(n.toPhone);
          const recipientContact = await prisma.userContact.findFirst({
            where: { phoneNumber: cleanToPhone, channel: BotChannel.WHATSAPP },
          });
          const recipientId = recipientContact ? recipientContact.userId : null;
          const outgoing = await this.sendWhatsAppAndLog(recipientId, cleanToPhone, n.rawText);
          outgoingMessages.push(outgoing);
        }
      }
      return {
        ...result,
        outgoing: outgoingMessages,
      };
    } else {
      // NEEDS_CONFIRMATION or FAILED
      const replyText = result.message || 'Command execution failed.';
      
      // Send response and log outgoing BotMessage
      const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);

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
