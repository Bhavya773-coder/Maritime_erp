import prisma from '../../config/db';
import { env } from '../../config/env';
import { BotService } from './bot.service';
import { BotChannel } from '@prisma/client';
import { BotReplyService } from './bot.reply-service';
import { LlmService } from './llm.service';

export class WhatsAppService {
  /**
   * Check if user is within the 24-hour WhatsApp conversation window.
   */
  public static async isWithinConversationWindow(userId: string): Promise<boolean> {
    const lastIncoming = await prisma.botMessage.findFirst({
      where: {
        direction: 'INCOMING',
        channel: BotChannel.WHATSAPP,
        fromUserId: userId,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!lastIncoming) return false;
    const windowMs = 24 * 60 * 60 * 1000;
    return (Date.now() - new Date(lastIncoming.createdAt).getTime()) < windowMs;
  }

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

      const resBody = await response.json();

      if (!response.ok) {
        console.error(`[WhatsApp API Error] HTTP ${response.status}: ${JSON.stringify(resBody)}`);
        throw new Error(`WhatsApp API error: ${JSON.stringify(resBody)}`);
      }

      // Log the actual message ID for traceability
      const msgId = (resBody as any)?.messages?.[0]?.id || 'unknown';
      console.log(`[WhatsApp API] Text message accepted. wamid: ${msgId}, to: ${cleanPhone}`);

      return resBody;
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

      const resBody = await response.json();

      if (!response.ok) {
        console.error(`[WhatsApp API Template Error] HTTP ${response.status}: ${JSON.stringify(resBody)}`);
        throw new Error(`WhatsApp API template error: ${JSON.stringify(resBody)}`);
      }

      const msgId = (resBody as any)?.messages?.[0]?.id || 'unknown';
      console.log(`[WhatsApp API] Template message accepted. wamid: ${msgId}, to: ${cleanPhone}, template: ${templateName}`);

      return resBody;
    } catch (err: any) {
      console.error('[WhatsApp Service Template Exception]', err);
      return { status: 'FAILED_SEND_FALLBACK_SIMULATED', error: err.message };
    }
  }

  /**
   * Send WhatsApp text message (or template) and log as outgoing BotMessage.
   * Returns the created BotMessage record.
   */
  public static async sendWhatsAppAndLog(
    toUserId: string | null,
    toPhone: string,
    messageText: string
  ): Promise<any> {
    const cleanPhone = this.normalizePhone(toPhone);
    const isSimulated = !env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID;

    let type = 'TEXT';
    let sendResult: any = null;
    let actualStatus: string = isSimulated ? 'SIMULATED' : 'SENT';

    // Check if the outgoing message is a task assignment or delegation, and if we should use templates
    if (env.WHATSAPP_TEMPLATE_NAME) {
      // 1. Check if it's a direct task assignment
      const taskAssignMatch = messageText.match(/^New task from (.+?): (.+?)\. Reply UPDATE, DONE, or DELEGATE\.$/);
      if (taskAssignMatch) {
        const senderName = taskAssignMatch[1];
        const taskTitle = taskAssignMatch[2];
        type = 'TEMPLATE';
        sendResult = await this.sendWhatsAppTemplate(
          cleanPhone,
          env.WHATSAPP_TEMPLATE_NAME,
          env.WHATSAPP_TEMPLATE_LANG || 'en',
          [senderName, taskTitle]
        );

        // If template failed, fall back to plain text
        if (sendResult?.status === 'FAILED_SEND_FALLBACK_SIMULATED') {
          console.warn(`[WhatsAppService] Template failed for ${cleanPhone}. Falling back to plain text.`);
          sendResult = await this.sendWhatsAppText(cleanPhone, messageText);
          actualStatus = sendResult?.status === 'SIMULATED' ? 'SIMULATED' : 'SENT_FALLBACK_TEXT';
        }
      } else {
        // 2. Check if it's a task delegation
        const taskDelegateMatch = messageText.match(/^New task delegated to you by (.+?): (.+?)\. Note: (.+)$/);
        if (taskDelegateMatch) {
          const senderName = `${taskDelegateMatch[1]} (Delegated)`;
          const taskTitle = `${taskDelegateMatch[2]} (Note: ${taskDelegateMatch[3]})`;
          type = 'TEMPLATE';
          sendResult = await this.sendWhatsAppTemplate(
            cleanPhone,
            env.WHATSAPP_TEMPLATE_NAME,
            env.WHATSAPP_TEMPLATE_LANG || 'en',
            [senderName, taskTitle]
          );

          // If template failed, fall back to plain text
          if (sendResult?.status === 'FAILED_SEND_FALLBACK_SIMULATED') {
            console.warn(`[WhatsAppService] Template failed for ${cleanPhone}. Falling back to plain text.`);
            sendResult = await this.sendWhatsAppText(cleanPhone, messageText);
            actualStatus = sendResult?.status === 'SIMULATED' ? 'SIMULATED' : 'SENT_FALLBACK_TEXT';
          }
        } else {
          sendResult = await this.sendWhatsAppText(cleanPhone, messageText);
        }
      }
    } else {
      sendResult = await this.sendWhatsAppText(cleanPhone, messageText);
    }

    // Log the actual status based on whether the API call succeeded
    if (sendResult?.status === 'FAILED_SEND_FALLBACK_SIMULATED') {
      actualStatus = 'FAILED';
      console.error(`[WhatsAppService] Message FAILED to send to ${cleanPhone}. Message: "${messageText.substring(0, 60)}..."`);
    } else if (sendResult?.status === 'SIMULATED') {
      actualStatus = 'SIMULATED';
      console.log(`[WhatsAppService] SIMULATED message to ${cleanPhone}: "${messageText.substring(0, 60)}..."`);
    } else if (sendResult?.messages?.[0]?.id) {
      // Real API success with message ID
      const msgId = sendResult.messages[0].id;
      console.log(`[WhatsAppService] Message SENT to ${cleanPhone}. wamid: ${msgId}. Text: "${messageText.substring(0, 60)}..."`);
    } else {
      // API returned something unexpected (possibly an error in the body)
      actualStatus = 'FAILED';
      console.error(`[WhatsAppService] Message FAILED to send to ${cleanPhone}. Unexpected API response: ${JSON.stringify(sendResult)}. Text: "${messageText.substring(0, 60)}..."`);
    }

    return await prisma.botMessage.create({
      data: {
        direction: 'OUTGOING',
        channel: BotChannel.WHATSAPP,
        toUserId,
        toPhone: cleanPhone,
        rawText: messageText,
        messageType: type,
        status: actualStatus,
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

    // D. Route ALL messages through the LLM
    // Only "menu" gets a special fast-path for WhatsApp interactive buttons
    const cleanMsg = textBody.trim().toLowerCase();
    if (cleanMsg === 'menu' || cleanMsg === 'buttons') {
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

    // E. LLM-powered AI response for ALL other messages
    try {
      const translation = await LlmService.translateMessage(
        textBody,
        senderUser.id,
        senderUser.name,
        senderUser.role
      );

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

      if (!translation.isERPRelated) {
        const replyText = translation.directResponse || "I am an ERP assistant and can only help with ERP tasks like scheduling, vessel updates, and staff queries. Please ask an office-related question.";
        const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
        return {
          status: 'failed',
          message: replyText,
          outgoing: [outgoing],
        };
      }

      // Execute database operations if requested by AI
      let notifications: any[] = [];
      let taskCreatedByLLM = false;
      if (translation.dbOperations && translation.dbOperations.length > 0) {
        const opResult = await LlmService.executeDbOperations(
          translation.dbOperations,
          senderUser.id,
          senderUser.name
        );
        notifications = opResult.notifications;
        taskCreatedByLLM = translation.dbOperations.some((op: any) => op.action === 'createTask');
      }

      // Safety net: if LLM claimed to create a task but didn't include dbOperations,
      // warn the user so they know to retry
      let replyText = translation.directResponse || "I understood your message but had trouble generating a response. Please try again.";
      const isTaskLikeMessage = /task|assign|give.*to|send.*to|ask.*to/i.test(textBody);
      if (isTaskLikeMessage && !taskCreatedByLLM) {
        console.warn('[WhatsAppService] LLM claimed to create a task but dbOperations was empty. Warning user.');
        replyText += "\n\n⚠️ I couldn't actually create the task. Please retry with a clearer message like: \"Assign [task description] to [person name]\"";
      }

      const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);

      // Dispatch and log generated notifications
      // For new users outside 24h window: sendWhatsAppAndLog auto-detects template and sends template message
      // For users inside 24h window: also send interactive buttons as follow-up for convenience
      const outgoingNotifications: any[] = [];
      console.log(`[WhatsAppService] Processing ${notifications.length} notification(s) from LLM operations...`);
      for (const n of notifications) {
        if (!n.toPhone) {
          console.warn(`[WhatsAppService] Notification skipped for user ${n.toUserId}: no phone number.`);
          continue;
        }
        console.log(`[WhatsAppService] Dispatching notification to phone ${n.toPhone}: "${n.rawText.substring(0, 80)}..."`);

        // Step 1: Always send the message (template or text) — bypasses 24h window for templates
        let outgoingNotif;
        try {
          outgoingNotif = await this.sendWhatsAppAndLog(
            n.toUserId || null,
            n.toPhone,
            n.rawText
          );
          outgoingNotifications.push(outgoingNotif);
        } catch (sendErr: any) {
          console.error(`[WhatsAppService] FAILED to send notification to ${n.toPhone}: ${sendErr.message}`);
          continue;
        }

        // Step 2: If user is within 24h window, also send interactive buttons for convenience
        if (n.messageType === 'INTERACTIVE_BUTTON' && n.taskId && n.toUserId) {
          const inWindow = await this.isWithinConversationWindow(n.toUserId);
          if (inWindow) {
            try {
              const buttonNotif = await this.sendWhatsAppTaskButtonsAndLog(
                n.toUserId,
                n.toPhone,
                n.rawText,
                n.taskId
              );
              outgoingNotifications.push(buttonNotif);
              console.log(`[WhatsAppService] Also sent interactive buttons to user ${n.toUserId}`);
            } catch (btnErr: any) {
              console.warn('[WhatsAppService] Buttons follow-up failed (non-critical):', btnErr.message);
            }
          } else {
            console.log(`[WhatsAppService] User ${n.toUserId} outside 24h window. Skipped interactive buttons.`);
          }
        }
      }
      console.log(`[WhatsAppService] Notification dispatch complete. Total outgoing messages: ${outgoingNotifications.length}`);

      return {
        status: 'success',
        message: translation.directResponse,
        outgoing: [outgoing, ...outgoingNotifications],
      };
    } catch (err) {
      console.error('[WhatsAppService] Error during LLM processing:', err);

      // Log incoming message even on error
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

      const replyText = "Sorry, I'm having trouble processing your request right now. Please try again in a moment.";
      const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
      return {
        status: 'error',
        message: replyText,
        outgoing: [outgoing],
      };
    }
  }
}
