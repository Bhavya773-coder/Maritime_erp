import prisma from '../../config/db';
import { env } from '../../config/env';
import { BotService } from './bot.service';
import { BotChannel, Role } from '@prisma/client';
import { BotReplyParser } from './bot.reply-parser';
import { BotStaffService } from './bot.staff-service';
import { BotReplyService } from './bot.reply-service';
import { BotFleetParser } from './bot.fleet-parser';
import { BotFleetService } from './bot.fleet-service';
import { LlmService } from './llm.service';

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
   * Send WhatsApp task action buttons (Done, Update, Delegate) and log as outgoing BotMessage
   */
  public static async sendWhatsAppTaskButtonsAndLog(
    toUserId: string | null,
    toPhone: string,
    bodyText: string,
    taskId: string
  ): Promise<any> {
    const cleanPhone = this.normalizePhone(toPhone);
    const isSimulated = !env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID;

    const buttons = [
      { id: `task_done:${taskId}`, title: '✅ Done' },
      { id: `task_update:${taskId}`, title: '✏️ Update' },
      { id: `task_delegate:${taskId}`, title: '🔁 Delegate' }
    ];

    await this.sendWhatsAppButtons(cleanPhone, bodyText, buttons);

    const status = isSimulated ? 'SIMULATED' : 'SENT';
    const logText = `${bodyText}\n[Task Buttons: Done | Update | Delegate]`;

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
                let buttonId = '';
                const fromPhone = msg.from;
                const messageId = msg.id;

                if (msg.type === 'text' && msg.text && msg.text.body) {
                  textBody = msg.text.body;
                } else if (msg.type === 'interactive' && msg.interactive) {
                  if (msg.interactive.button_reply) {
                    textBody = msg.interactive.button_reply.title || '';
                    buttonId = msg.interactive.button_reply.id || '';
                  } else if (msg.interactive.list_reply) {
                    textBody = msg.interactive.list_reply.title || '';
                    buttonId = msg.interactive.list_reply.id || '';
                  }
                }

                if (textBody) {
                  await this.processIncomingMessage(fromPhone, textBody, messageId, buttonId);
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
    providerMessageId: string,
    buttonId?: string
  ): Promise<any> {
    const cleanPhone = this.normalizePhone(fromPhone);
    const originalTextBody = textBody;
    let currentText = textBody;

    // Deduplication check
    const existingMessage = await prisma.botMessage.findFirst({
      where: {
        providerMessageId,
        direction: 'INCOMING',
        channel: BotChannel.WHATSAPP,
      },
    });
    if (existingMessage) {
      console.log(`[WhatsAppService] Duplicate message detected: ${providerMessageId}. Skipping processing.`);
      return { status: 'skipped', reason: 'duplicate' };
    }

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

    // A. Handle cancel/exit command to clear active sessions
    const lowerText = textBody.trim().toLowerCase();
    if (lowerText === 'cancel' || lowerText === 'exit') {
      const deleted = await prisma.botSession.deleteMany({
        where: { userId: senderUser.id }
      });
      if (deleted.count > 0) {
        await prisma.botMessage.create({
          data: {
            direction: 'INCOMING',
            channel: BotChannel.WHATSAPP,
            fromUserId: senderUser.id,
            fromPhone: cleanPhone,
            rawText: originalTextBody,
            messageType: 'TEXT',
            status: 'RECEIVED',
            providerMessageId,
          },
        });
        const replyText = "Cancelled active action.";
        const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
        return { status: 'success', message: replyText, outgoing: [outgoing] };
      }
    }

    // B. Handle Button Clicks (if buttonId is provided)
    if (buttonId) {
      if (buttonId.startsWith('task_done:')) {
        const taskId = buttonId.split(':')[1];
        
        // Log incoming message for button click
        await prisma.botMessage.create({
          data: {
            direction: 'INCOMING',
            channel: BotChannel.WHATSAPP,
            fromUserId: senderUser.id,
            fromPhone: cleanPhone,
            rawText: originalTextBody,
            messageType: 'TEXT',
            status: 'RECEIVED',
            providerMessageId,
          },
        });

        const replyCommand = { type: 'DONE' as const, targetTaskId: taskId };
        return await BotReplyService.executeReplyCommand(senderUser, replyCommand, cleanPhone, providerMessageId);
      }

      if (buttonId.startsWith('task_update:')) {
        const taskId = buttonId.split(':')[1];
        const task = await prisma.task.findUnique({ where: { id: taskId } });
        if (!task) {
          const replyText = "Task not found.";
          const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
          return { status: 'error', message: replyText, outgoing: [outgoing] };
        }

        // Save session state
        await prisma.botSession.upsert({
          where: { userId: senderUser.id },
          create: { userId: senderUser.id, state: 'AWAITING_TASK_UPDATE', taskId },
          update: { state: 'AWAITING_TASK_UPDATE', taskId }
        });

        // Log incoming message
        await prisma.botMessage.create({
          data: {
            direction: 'INCOMING',
            channel: BotChannel.WHATSAPP,
            fromUserId: senderUser.id,
            fromPhone: cleanPhone,
            rawText: originalTextBody,
            messageType: 'TEXT',
            status: 'RECEIVED',
            providerMessageId,
          },
        });

        const replyText = `You selected to update the task:\n*"${task.title}"*\n\nPlease reply directly with your update text (e.g. 'I don't have funds'). Type 'cancel' to exit.`;
        const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
        return { status: 'success', message: replyText, outgoing: [outgoing] };
      }

      if (buttonId.startsWith('task_delegate:')) {
        const taskId = buttonId.split(':')[1];
        const task = await prisma.task.findUnique({ where: { id: taskId } });
        if (!task) {
          const replyText = "Task not found.";
          const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
          return { status: 'error', message: replyText, outgoing: [outgoing] };
        }

        // Save session state
        await prisma.botSession.upsert({
          where: { userId: senderUser.id },
          create: { userId: senderUser.id, state: 'AWAITING_TASK_DELEGATION', taskId },
          update: { state: 'AWAITING_TASK_DELEGATION', taskId }
        });

        // Log incoming message
        await prisma.botMessage.create({
          data: {
            direction: 'INCOMING',
            channel: BotChannel.WHATSAPP,
            fromUserId: senderUser.id,
            fromPhone: cleanPhone,
            rawText: originalTextBody,
            messageType: 'TEXT',
            status: 'RECEIVED',
            providerMessageId,
          },
        });

        const replyText = `You selected to delegate the task:\n*"${task.title}"*\n\nPlease reply with the name of the person you want to delegate this task to (e.g. 'Hardik'). Type 'cancel' to exit.`;
        const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
        return { status: 'success', message: replyText, outgoing: [outgoing] };
      }

      if (buttonId.startsWith('delegate_select:')) {
        const parts = buttonId.split(':');
        const taskId = parts[1];
        const assigneeId = parts[2];

        const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
        if (!assignee) {
          const replyText = "Assignee not found.";
          const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
          return { status: 'error', message: replyText, outgoing: [outgoing] };
        }

        // Log incoming message
        await prisma.botMessage.create({
          data: {
            direction: 'INCOMING',
            channel: BotChannel.WHATSAPP,
            fromUserId: senderUser.id,
            fromPhone: cleanPhone,
            rawText: originalTextBody,
            messageType: 'TEXT',
            status: 'RECEIVED',
            providerMessageId,
          },
        });

        const replyCommand = { 
          type: 'DELEGATE' as const, 
          targetTaskId: taskId, 
          assigneeName: assignee.name,
          message: 'Delegated via button choice.'
        };

        const result = await BotReplyService.executeReplyCommand(senderUser, replyCommand, cleanPhone, providerMessageId);

        // Clear session
        await prisma.botSession.deleteMany({
          where: { userId: senderUser.id }
        });

        return result;
      }
    }

    // C. Intercept Active Session States (if they exist)
    const session = await prisma.botSession.findUnique({
      where: { userId: senderUser.id }
    });

    if (session) {
      if (session.state === 'AWAITING_TASK_UPDATE' && session.taskId) {
        // Log incoming message
        await prisma.botMessage.create({
          data: {
            direction: 'INCOMING',
            channel: BotChannel.WHATSAPP,
            fromUserId: senderUser.id,
            fromPhone: cleanPhone,
            rawText: originalTextBody,
            messageType: 'TEXT',
            status: 'RECEIVED',
            providerMessageId,
          },
        });

        const replyCommand = { 
          type: 'UPDATE' as const, 
          targetTaskId: session.taskId, 
          message: textBody 
        };

        const result = await BotReplyService.executeReplyCommand(senderUser, replyCommand, cleanPhone, providerMessageId);
        
        // Clear session
        await prisma.botSession.delete({
          where: { userId: senderUser.id }
        });

        return result;
      }

      if (session.state === 'AWAITING_TASK_DELEGATION' && session.taskId) {
        // Log incoming message
        await prisma.botMessage.create({
          data: {
            direction: 'INCOMING',
            channel: BotChannel.WHATSAPP,
            fromUserId: senderUser.id,
            fromPhone: cleanPhone,
            rawText: originalTextBody,
            messageType: 'TEXT',
            status: 'RECEIVED',
            providerMessageId,
          },
        });

        const candidates = await BotService.resolveAssignee(textBody);

        if (candidates.length === 0) {
          const replyText = `Could not resolve assignee "${textBody}". No active user or department matched. Please reply with another name to try again, or type 'cancel' to exit.`;
          const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
          return { status: 'failed', message: replyText, outgoing: [outgoing] };
        }

        if (candidates.length > 1) {
          // If there are multiple matches, let them choose using interactive buttons! (Max 3 candidates)
          if (candidates.length <= 3) {
            const bodyText = `Multiple matches found for "${textBody}". Please select the correct assignee below:`;
            const buttons = candidates.map(c => ({
              id: `delegate_select:${session.taskId}:${c.id}`,
              title: c.name
            }));
            const outgoing = await this.sendWhatsAppButtonsAndLog(senderUser.id, cleanPhone, bodyText, buttons);
            return { status: 'NEEDS_CONFIRMATION', message: bodyText, outgoing: [outgoing] };
          } else {
            let replyText = `Multiple matches found for "${textBody}". Please specify the name more clearly:\n`;
            candidates.forEach((c, i) => {
              replyText += `${i + 1}. ${c.name} (${c.department})\n`;
            });
            replyText += "\nReply with the exact name, or type 'cancel' to exit.";
            const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
            return { status: 'NEEDS_CONFIRMATION', message: replyText, outgoing: [outgoing] };
          }
        }

        // Exactly one match
        const assignee = candidates[0];
        const replyCommand = { 
          type: 'DELEGATE' as const, 
          targetTaskId: session.taskId, 
          assigneeName: assignee.name,
          message: 'Delegated via WhatsApp selection.'
        };

        const result = await BotReplyService.executeReplyCommand(senderUser, replyCommand, cleanPhone, providerMessageId);

        // Clear session
        await prisma.botSession.delete({
          where: { userId: senderUser.id }
        });

        return result;
      }
    }

    // Helper to process predefined rigid commands
    const runPredefinedCommands = async (textToProcess: string): Promise<any | null> => {
      const cleanMsg = textToProcess.trim().toLowerCase();

      // 1. Check if it is a menu/buttons/start/hi/hello/hey command
      if (cleanMsg === 'menu' || cleanMsg === 'buttons' || cleanMsg === 'start' || cleanMsg === 'hi' || cleanMsg === 'hello' || cleanMsg === 'hey') {
        await prisma.botMessage.create({
          data: {
            direction: 'INCOMING',
            channel: BotChannel.WHATSAPP,
            fromUserId: senderUser.id,
            fromPhone: cleanPhone,
            rawText: originalTextBody,
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

      // 2. Check if it is an ADD STAFF command
      const addStaffMatch = textToProcess.trim().match(/^add\s+staff\s+(.+?)\s+(\+?\d[\d\s-]+)\s+(.+)$/i);
      if (addStaffMatch) {
        await prisma.botMessage.create({
          data: {
            direction: 'INCOMING',
            channel: BotChannel.WHATSAPP,
            fromUserId: senderUser.id,
            fromPhone: cleanPhone,
            rawText: originalTextBody,
            messageType: 'TEXT',
            status: 'RECEIVED',
            providerMessageId,
          },
        });

        if (!contact || !contact.isVerified || (contact.user.role !== Role.OWNER && contact.user.role !== Role.MANAGER)) {
          const replyText = 'Error: Unauthorized. Only registered and verified Owners or Managers can add staff.';
          const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
          return {
            status: 'failed',
            message: replyText,
            outgoing: [outgoing],
          };
        }

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

      // 3. Check if it is a STAFF LIST command
      const isStaffListQuery = /^(?:staff\s+list|list\s+staff|show\s+all\s+staff|show\s+staff|how\s+many\s+members(?:\s+do\s+(?:i|we)\s+have)?)$/i.test(cleanMsg);
      if (isStaffListQuery) {
        await prisma.botMessage.create({
          data: {
            direction: 'INCOMING',
            channel: BotChannel.WHATSAPP,
            fromUserId: senderUser.id,
            fromPhone: cleanPhone,
            rawText: originalTextBody,
            messageType: 'TEXT',
            status: 'RECEIVED',
            providerMessageId,
          },
        });

        if (!contact || !contact.isVerified) {
          const replyText = 'Error: Unauthorized. Only registered and verified users can view the staff list.';
          const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
          return {
            status: 'failed',
            message: replyText,
            outgoing: [outgoing],
          };
        }

        const replyText = await BotStaffService.listStaff();
        const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
        return {
          status: 'success',
          message: replyText,
          outgoing: [outgoing],
        };
      }

      // 4. Check if it is an AG STAFF LIST command
      const isAGStaffListQuery = /^(?:list\s+ag\s+staff|ag\s+staff)$/i.test(cleanMsg);
      if (isAGStaffListQuery) {
        await prisma.botMessage.create({
          data: {
            direction: 'INCOMING',
            channel: BotChannel.WHATSAPP,
            fromUserId: senderUser.id,
            fromPhone: cleanPhone,
            rawText: originalTextBody,
            messageType: 'TEXT',
            status: 'RECEIVED',
            providerMessageId,
          },
        });

        if (!contact || !contact.isVerified) {
          const replyText = 'Error: Unauthorized. Only registered and verified users can view the AG staff list.';
          const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
          return {
            status: 'failed',
            message: replyText,
            outgoing: [outgoing],
          };
        }

        const replyText = await BotStaffService.listAGStaff();
        const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
        return {
          status: 'success',
          message: replyText,
          outgoing: [outgoing],
        };
      }

      // 5. Check if it is an OWNERS LIST command
      const isOwnersListQuery = /^(?:owners|list\s+owners)$/i.test(cleanMsg);
      if (isOwnersListQuery) {
        await prisma.botMessage.create({
          data: {
            direction: 'INCOMING',
            channel: BotChannel.WHATSAPP,
            fromUserId: senderUser.id,
            fromPhone: cleanPhone,
            rawText: originalTextBody,
            messageType: 'TEXT',
            status: 'RECEIVED',
            providerMessageId,
          },
        });

        if (!contact || !contact.isVerified) {
          const replyText = 'Error: Unauthorized. Only registered and verified users can view the owners list.';
          const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
          return {
            status: 'failed',
            message: replyText,
            outgoing: [outgoing],
          };
        }

        const replyText = await BotStaffService.listOwners();
        const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
        return {
          status: 'success',
          message: replyText,
          outgoing: [outgoing],
        };
      }

      // 6. Check if it is a reply command
      const replyCommand = BotReplyParser.parse(textToProcess);
      if (replyCommand) {
        await prisma.botMessage.create({
          data: {
            direction: 'INCOMING',
            channel: BotChannel.WHATSAPP,
            fromUserId: senderUser.id,
            fromPhone: cleanPhone,
            rawText: originalTextBody,
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

      // 7. Check if it is a fleet info query
      const fleetQuery = BotFleetParser.parse(textToProcess);
      if (fleetQuery) {
        await prisma.botMessage.create({
          data: {
            direction: 'INCOMING',
            channel: BotChannel.WHATSAPP,
            fromUserId: senderUser.id,
            fromPhone: cleanPhone,
            rawText: originalTextBody,
            messageType: 'TEXT',
            status: 'RECEIVED',
            providerMessageId,
          },
        });

        const replyText = await BotFleetService.executeQuery(fleetQuery, senderUser.id);
        
        const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);

        return {
          status: 'success',
          message: replyText,
          outgoing: [outgoing],
        };
      }

      return null;
    };

    // Run predefined check first (fast-path)
    const fastPathResult = await runPredefinedCommands(textBody);
    if (fastPathResult) {
      return fastPathResult;
    }

    // LLM translation and scope validation
    if (env.LLAMA_API_URL) {
      try {
        const translation = await LlmService.translateMessage(textBody, senderUser.id, senderUser.name, senderUser.role);
        if (!translation.isERPRelated) {
          await prisma.botMessage.create({
            data: {
              direction: 'INCOMING',
              channel: BotChannel.WHATSAPP,
              fromUserId: senderUser.id,
              fromPhone: cleanPhone,
              rawText: originalTextBody,
              messageType: 'TEXT',
              status: 'RECEIVED',
              providerMessageId,
            },
          });

          const replyText = "I am an ERP assistant and can only help with ERP tasks like scheduling, vessel updates, and staff queries. Please ask an office-related question.";
          const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
          return {
            status: 'failed',
            message: replyText,
            outgoing: [outgoing],
          };
        } else if (translation.directResponse) {
          // Execute database operations if requested by AI
          let notifications: any[] = [];
          if (translation.dbOperations && translation.dbOperations.length > 0) {
            const opResult = await LlmService.executeDbOperations(translation.dbOperations, senderUser.id, senderUser.name);
            notifications = opResult.notifications;
          }

          // Log incoming BotMessage with original text
          await prisma.botMessage.create({
            data: {
              direction: 'INCOMING',
              channel: BotChannel.WHATSAPP,
              fromUserId: senderUser.id,
              fromPhone: cleanPhone,
              rawText: originalTextBody,
              messageType: 'TEXT',
              status: 'RECEIVED',
              providerMessageId,
            },
          });

          const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, translation.directResponse);

          // Dispatch and log generated notifications
          const outgoingNotifications: any[] = [];
          for (const n of notifications) {
            if (n.toPhone) {
              let outgoingNotif;
              if (n.messageType === 'INTERACTIVE_BUTTON' && n.taskId) {
                outgoingNotif = await this.sendWhatsAppTaskButtonsAndLog(
                  n.toUserId || null,
                  n.toPhone,
                  n.rawText,
                  n.taskId
                );
              } else {
                outgoingNotif = await this.sendWhatsAppAndLog(
                  n.toUserId || null,
                  n.toPhone,
                  n.rawText
                );
              }
              outgoingNotifications.push(outgoingNotif);
            }
          }

          return {
            status: 'success',
            message: translation.directResponse,
            outgoing: [outgoing, ...outgoingNotifications],
          };
        } else if (translation.extractedCommand) {
          console.log(`[LlmService] Natural language: "${textBody}" -> Command: "${translation.extractedCommand}"`);
          currentText = translation.extractedCommand;

          // Re-evaluate the extracted command against predefined commands
          const extractedResult = await runPredefinedCommands(currentText);
          if (extractedResult) {
            return extractedResult;
          }
        }
      } catch (err) {
        console.error('[LlmService] Error during translation, falling back to raw message:', err);
      }
    }

    // Log incoming BotMessage for fallback command execution
    await prisma.botMessage.create({
      data: {
        direction: 'INCOMING',
        channel: BotChannel.WHATSAPP,
        fromUserId: senderUser.id,
        fromPhone: cleanPhone,
        rawText: originalTextBody,
        messageType: 'TEXT',
        status: 'RECEIVED',
        providerMessageId,
      },
    });

    // Call processCommand in Bot Core
    const result = await BotService.processCommand(currentText, senderUser, {
      channel: BotChannel.WHATSAPP,
      fromPhone: cleanPhone,
      providerMessageId,
    });

    if (result.status === 'success' && result.data) {
      const notifications = result.data.notifications;
      const outgoingMessages: any[] = [];
      for (const n of notifications) {
        if (n.toPhone) {
          const cleanToPhone = this.normalizePhone(n.toPhone);
          const recipientContact = await prisma.userContact.findFirst({
            where: { phoneNumber: cleanToPhone, channel: BotChannel.WHATSAPP },
          });
          const recipientId = recipientContact ? recipientContact.userId : null;
          
          let outgoing;
          if (n.messageType === 'INTERACTIVE_BUTTON' && n.taskId) {
            outgoing = await this.sendWhatsAppTaskButtonsAndLog(
              recipientId,
              cleanToPhone,
              n.rawText,
              n.taskId
            );
          } else {
            outgoing = await this.sendWhatsAppAndLog(recipientId, cleanToPhone, n.rawText);
          }
          outgoingMessages.push(outgoing);
        }
      }
      return {
        ...result,
        outgoing: outgoingMessages,
      };
    } else {
      const replyText = result.message || 'Command execution failed.';
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
