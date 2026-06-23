import prisma from '../../config/db';
import { env } from '../../config/env';
import crypto from 'crypto';
import { BotService } from './bot.service';
import { BotChannel } from '@prisma/client';
import { BotReplyService } from './bot.reply-service';
import { LlmService } from './llm.service';
import { BotReplyParser } from './bot.reply-parser';
import { BotFleetParser } from './bot.fleet-parser';
import { BotFleetService } from './bot.fleet-service';
import { BotDocumentParser } from './bot.document-parser';
import { BotDocumentService } from './bot.document-service';
import { ConversationContextService } from './conversation-context';
import { ConfirmationService } from './confirmation-service';

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

    sendResult = await this.sendWhatsAppText(cleanPhone, messageText);

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
   * Send WhatsApp document message using Cloud API
   */
  public static async sendWhatsAppDocument(
    toPhone: string,
    fileUrl: string,
    fileName: string,
    caption?: string
  ): Promise<any> {
    const cleanPhone = this.normalizePhone(toPhone);
    
    if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
      console.log(`[SIMULATED WHATSAPP DOCUMENT] To: ${cleanPhone}, Link: ${fileUrl}, Filename: ${fileName}, Caption: ${caption}`);
      return { status: 'SIMULATED_DOCUMENT', to: cleanPhone, document: fileUrl, filename: fileName, caption };
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
          type: 'document',
          document: {
            link: fileUrl,
            filename: fileName,
            ...(caption ? { caption } : {})
          }
        }),
      });

      const resBody = await response.json();

      if (!response.ok) {
        console.error(`[WhatsApp API Document Error] HTTP ${response.status}: ${JSON.stringify(resBody)}`);
        throw new Error(`WhatsApp API document error: ${JSON.stringify(resBody)}`);
      }

      const msgId = (resBody as any)?.messages?.[0]?.id || 'unknown';
      console.log(`[WhatsApp API] Document message accepted. wamid: ${msgId}, to: ${cleanPhone}`);

      return resBody;
    } catch (err: any) {
      console.error('[WhatsApp Service Document Exception]', err);
      return { status: 'FAILED_SEND_FALLBACK_SIMULATED', error: err.message };
    }
  }

  /**
   * Send WhatsApp document message and log as outgoing BotMessage.
   * Returns the created BotMessage record.
   */
  public static async sendWhatsAppDocumentAndLog(
    toUserId: string | null,
    toPhone: string,
    fileUrl: string,
    fileName: string,
    caption?: string
  ): Promise<any> {
    const cleanPhone = this.normalizePhone(toPhone);
    const isSimulated = !env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID;

    let sendResult = await this.sendWhatsAppDocument(cleanPhone, fileUrl, fileName, caption);
    let actualStatus = isSimulated ? 'SIMULATED' : 'SENT';

    if (sendResult?.status === 'FAILED_SEND_FALLBACK_SIMULATED') {
      actualStatus = 'FAILED';
      console.error(`[WhatsAppService] Document FAILED to send to ${cleanPhone}. File: "${fileName}"`);
    } else if (sendResult?.status === 'SIMULATED_DOCUMENT') {
      actualStatus = 'SIMULATED';
      console.log(`[WhatsAppService] SIMULATED document to ${cleanPhone}: "${fileName}"`);
    } else if (sendResult?.messages?.[0]?.id) {
      const msgId = sendResult.messages[0].id;
      console.log(`[WhatsAppService] Document SENT to ${cleanPhone}. wamid: ${msgId}. File: "${fileName}"`);
    } else {
      actualStatus = 'FAILED';
      console.error(`[WhatsAppService] Document FAILED to send to ${cleanPhone}. Unexpected response: ${JSON.stringify(sendResult)}`);
    }

    const logText = `📄 Document: ${fileName}\n🔗 Download: ${fileUrl}${caption ? `\nCaption: ${caption}` : ''}`;

    return await prisma.botMessage.create({
      data: {
        direction: 'OUTGOING',
        channel: BotChannel.WHATSAPP,
        toUserId,
        toPhone: cleanPhone,
        rawText: logText,
        messageType: 'DOCUMENT',
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
   * Meta Webhook signature verification
   */
  public static verifyWebhookSignature(signature: string | undefined, body: any): boolean {
    const appSecret = process.env.WHATSAPP_APP_SECRET || env.META_APP_SECRET;
    if (!appSecret) {
      // If app secret is not configured, pass validation for ease of local testing
      return true;
    }
    if (!signature) {
      return false;
    }
    try {
      const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
      const sigHash = signature.startsWith('sha256=') ? signature.substring(7) : signature;
      const expectedHash = crypto
        .createHmac('sha256', appSecret)
        .update(rawBody)
        .digest('hex');
      
      return sigHash === expectedHash;
    } catch (err) {
      console.error('[WhatsAppService] Error verifying signature:', err);
      return false;
    }
  }

  /**
   * Downloads media file from Meta Graph API using the media ID.
   * Saves it to local storage and returns the local file path.
   */
  public static async downloadWhatsAppMedia(mediaId: string, targetFilename: string): Promise<string> {
    if (!env.WHATSAPP_ACCESS_TOKEN) {
      console.warn('[WhatsAppService] WHATSAPP_ACCESS_TOKEN not set. Simulating media download.');
      return `documents/uploads/${targetFilename}`;
    }

    try {
      const metadataUrl = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${mediaId}`;
      const metaRes = await fetch(metadataUrl, {
        headers: { 'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` }
      });

      if (!metaRes.ok) {
        throw new Error(`Failed to fetch media metadata: HTTP ${metaRes.status}`);
      }

      const metadata: any = await metaRes.json();
      const downloadUrl = metadata.url;

      if (!downloadUrl) {
        throw new Error('Media download URL is missing from metadata');
      }

      const mediaRes = await fetch(downloadUrl, {
        headers: { 'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` }
      });

      if (!mediaRes.ok) {
        throw new Error(`Failed to download media file: HTTP ${mediaRes.status}`);
      }

      const fs = require('fs');
      const path = require('path');
      const uploadDir = path.join(__dirname, '../../../documents/uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const destPath = path.join(uploadDir, targetFilename);
      const buffer = Buffer.from(await mediaRes.arrayBuffer());
      fs.writeFileSync(destPath, buffer);
      
      console.log(`[WhatsAppService] Media downloaded and saved to: ${destPath}`);
      return `documents/uploads/${targetFilename}`;
    } catch (err: any) {
      console.error('[WhatsAppService] Error downloading media:', err);
      throw err;
    }
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

                let mediaId = '';
                let mediaType = '';
                let mediaFilename = '';

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
                } else if (msg.type === 'document' && msg.document) {
                  mediaId = msg.document.id;
                  mediaType = 'document';
                  mediaFilename = msg.document.filename || `document-${Date.now()}.pdf`;
                  textBody = msg.document.caption || `[Uploaded Document: ${mediaFilename}]`;
                } else if (msg.type === 'image' && msg.image) {
                  mediaId = msg.image.id;
                  mediaType = 'image';
                  mediaFilename = `image-${Date.now()}.jpg`;
                  textBody = msg.image.caption || `[Uploaded Image: ${mediaFilename}]`;
                }

                if (textBody) {
                  await this.processIncomingMessage(
                    fromPhone, 
                    textBody, 
                    messageId, 
                    buttonId,
                    mediaId ? { mediaId, mediaType, mediaFilename } : undefined
                  );
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
    buttonId?: string,
    mediaInfo?: { mediaId: string; mediaType: string; mediaFilename: string }
  ): Promise<any> {
    const cleanPhone = this.normalizePhone(fromPhone);
    const originalTextBody = textBody;

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

    let senderUser: any = null;

    if (contact && contact.user && contact.user.isActive) {
      senderUser = contact.user;
    } else if (providerMessageId && providerMessageId.startsWith('simulated-msg-')) {
      // Fallback to Owner for test simulations
      const owner = await prisma.user.findFirst({
        where: { email: 'owner@apil.local' },
      });
      if (owner) {
        senderUser = {
          ...owner,
          name: `Unregistered (${cleanPhone})`,
        };
      }
    }

    if (!senderUser) {
      // Reject unknown or inactive numbers safely
      const replyText = "Your WhatsApp number is not registered with this company. Please contact the administrator.";
      await prisma.botMessage.create({
        data: {
          direction: 'INCOMING',
          channel: BotChannel.WHATSAPP,
          fromPhone: cleanPhone,
          rawText: originalTextBody,
          messageType: 'TEXT',
          status: 'RECEIVED',
          providerMessageId,
        },
      });
      const outgoing = await this.sendWhatsAppAndLog(null, cleanPhone, replyText);
      return { status: 'failed', message: replyText, outgoing: [outgoing] };
    }

    // Per-user rate limiting
    const recentMessages = await prisma.botMessage.count({
      where: {
        fromUserId: senderUser.id,
        direction: 'INCOMING',
        channel: BotChannel.WHATSAPP,
        createdAt: { gte: new Date(Date.now() - env.RATE_LIMIT_WHATSAPP_WINDOW_MS) },
      },
    });
    if (recentMessages > env.RATE_LIMIT_WHATSAPP_MAX) {
      const replyText = "You are sending messages too quickly. Please wait a moment and try again.";
      const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
      return { status: 'rate_limited', message: replyText, outgoing: [outgoing] };
    }

    // A. Handle cancel/exit command to clear active sessions
    const lowerText = textBody.trim().toLowerCase();
    if (lowerText === 'cancel' || lowerText === 'exit') {
      const deleted = await prisma.botSession.deleteMany({
        where: { userId: senderUser.id }
      });
      const { ConversationContextService } = require('./conversation-context');
      await ConversationContextService.setContext(senderUser.id, {
        pendingConfirmation: null,
        pendingClarification: null,
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

        await prisma.botSession.upsert({
          where: { userId: senderUser.id },
          create: { userId: senderUser.id, state: 'AWAITING_TASK_UPDATE', taskId },
          update: { state: 'AWAITING_TASK_UPDATE', taskId }
        });

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

        await prisma.botSession.upsert({
          where: { userId: senderUser.id },
          create: { userId: senderUser.id, state: 'AWAITING_TASK_DELEGATION', taskId },
          update: { state: 'AWAITING_TASK_DELEGATION', taskId }
        });

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
        await prisma.botSession.deleteMany({ where: { userId: senderUser.id } });
        return result;
      }
    }

    // C. Intercept Active Session States (if they exist)
    const session = await prisma.botSession.findUnique({
      where: { userId: senderUser.id }
    });

    if (session) {
      if (session.state === 'AWAITING_TASK_UPDATE' && session.taskId) {
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
        await prisma.botSession.delete({ where: { userId: senderUser.id } });
        return result;
      }

      if (session.state === 'AWAITING_TASK_DELEGATION' && session.taskId) {
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

        const assignee = candidates[0];
        const replyCommand = { 
          type: 'DELEGATE' as const, 
          targetTaskId: session.taskId, 
          assigneeName: assignee.name,
          message: 'Delegated via WhatsApp selection.'
        };

        const result = await BotReplyService.executeReplyCommand(senderUser, replyCommand, cleanPhone, providerMessageId);
        await prisma.botSession.delete({ where: { userId: senderUser.id } });
        return result;
      }

      // Handle document/image link session state
      if (session.state.startsWith('AWAITING_MEDIA_LINK:')) {
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

        const firstColonIdx = session.state.indexOf(':');
        const lastColonIdx = session.state.lastIndexOf(':');
        const secondLastColonIdx = session.state.lastIndexOf(':', lastColonIdx - 1);
        const savedPathParsed = session.state.substring(firstColonIdx + 1, secondLastColonIdx);
        const mediaFilenameParsed = session.state.substring(secondLastColonIdx + 1, lastColonIdx);
        const mediaTypeParsed = session.state.substring(lastColonIdx + 1);

        const vessel = await prisma.vessel.findFirst({
          where: { name: { contains: textBody, mode: 'insensitive' }, deletedAt: null }
        });

        if (!vessel) {
          const replyText = `Could not find a vessel matching "${textBody}". Please try again with the correct name, or type "cancel" to exit.`;
          const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
          return { status: 'failed', message: replyText, outgoing: [outgoing] };
        }

        const newDoc = await prisma.vesselDocument.create({
          data: {
            vesselId: vessel.id,
            docType: mediaTypeParsed === 'image' ? 'IMAGE' : 'DOCUMENT',
            fileName: mediaFilenameParsed,
            filePath: savedPathParsed,
            description: `Uploaded via WhatsApp by ${senderUser.name}`
          }
        });

        const { ConversationContextService } = require('./conversation-context');
        await ConversationContextService.setRecentAsset(senderUser.id, vessel.id, vessel.name);

        const replyText = `📄 File "${mediaFilenameParsed}" has been successfully attached to vessel *${vessel.name}*.`;
        const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
        await prisma.botSession.delete({ where: { userId: senderUser.id } });
        return { status: 'success', message: replyText, outgoing: [outgoing] };
      }
    }

    // D. Process media attachments if present
    if (mediaInfo) {
      await prisma.botMessage.create({
        data: {
          direction: 'INCOMING',
          channel: BotChannel.WHATSAPP,
          fromUserId: senderUser.id,
          fromPhone: cleanPhone,
          rawText: originalTextBody,
          messageType: mediaInfo.mediaType.toUpperCase(),
          status: 'RECEIVED',
          providerMessageId,
        },
      });

      let savedPath = '';
      try {
        savedPath = await this.downloadWhatsAppMedia(mediaInfo.mediaId, mediaInfo.mediaFilename);
      } catch (err: any) {
        console.error('[WhatsAppService] Webhook media download failed:', err);
        const replyText = "⚠️ I received your attachment but had an error downloading it. Please try again.";
        const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
        return { status: 'error', message: replyText, outgoing: [outgoing] };
      }

      const { ConversationContextService } = require('./conversation-context');
      const ctxState = await ConversationContextService.getContext(senderUser.id);

      if (ctxState.recentAssetId) {
        const vessel = await prisma.vessel.findUnique({
          where: { id: ctxState.recentAssetId }
        });

        if (vessel) {
          const newDoc = await prisma.vesselDocument.create({
            data: {
              vesselId: vessel.id,
              docType: mediaInfo.mediaType === 'image' ? 'IMAGE' : 'DOCUMENT',
              fileName: mediaInfo.mediaFilename,
              filePath: savedPath,
              description: `Uploaded via WhatsApp by ${senderUser.name}`
            }
          });

          let replyText = `📄 I have saved your file "${mediaInfo.mediaFilename}" and attached it to vessel *${vessel.name}*.`;

          if (ctxState.recentTaskId) {
            const task = await prisma.task.findUnique({ where: { id: ctxState.recentTaskId } });
            if (task) {
              const fileUrl = `${BotDocumentService.getBaseUrl()}/${savedPath}`;
              await prisma.taskComment.create({
                data: {
                  taskId: task.id,
                  userId: senderUser.id,
                  content: `📎 Attached file: ${mediaInfo.mediaFilename}\n🔗 View file: ${fileUrl}`
                }
              });
              replyText += `\nI have also linked it to the task: "${task.title}".`;
            }
          }

          const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
          return { status: 'success', message: replyText, outgoing: [outgoing] };
        }
      }

      const replyText = `I received your document "${mediaInfo.mediaFilename}". Please reply with the name of the vessel this document belongs to (e.g. "KB-26") so I can link it.`;
      await prisma.botSession.upsert({
        where: { userId: senderUser.id },
        create: { userId: senderUser.id, state: `AWAITING_MEDIA_LINK:${savedPath}:${mediaInfo.mediaFilename}:${mediaInfo.mediaType}` },
        update: { state: `AWAITING_MEDIA_LINK:${savedPath}:${mediaInfo.mediaFilename}:${mediaInfo.mediaType}` }
      });

      const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
      return { status: 'success', message: replyText, outgoing: [outgoing] };
    }

    // E. Route all regular messages through the LLM agent orchestrator loop
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

    // Process using LLM Orchestrator
    try {
      // Check for pending confirmations first
      const { ConfirmationService } = require('./confirmation-service');
      const pendingRes = await ConfirmationService.handleConfirmation(senderUser.id, senderUser, textBody);
      
      if (pendingRes && pendingRes.status !== 'NO_PENDING') {
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

        const replyText = pendingRes.message || "Action processed.";
        const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
        
        let extraOutgoings: any[] = [];
        if (pendingRes.status === 'CONFIRMED' && pendingRes.result?.notifications) {
          // Send notifications from execution if any
          for (const n of pendingRes.result.notifications) {
            if (n.toPhone) {
              const notifMsg = await this.sendWhatsAppAndLog(n.toUserId, n.toPhone, n.text);
              extraOutgoings.push(notifMsg);
            }
          }
        }

        return {
          status: 'success',
          message: replyText,
          outgoing: [outgoing, ...extraOutgoings],
        };
      }

      // Normal message -> LLM agent loop with tool-calling
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
        const replyText = translation.directResponse || "I am an ERP assistant and can only help with ERP tasks.";
        const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
        return { status: 'failed', message: replyText, outgoing: [outgoing] };
      }

      let replyText = translation.directResponse || "I have processed your request.";

      // Dispatch notifications from tool execution if present
      const outgoingNotifications: any[] = [];
      if (translation.notifications && translation.notifications.length > 0) {
        for (const n of translation.notifications) {
          if (!n.toPhone) continue;
          const nText = n.text || n.rawText;
          if (!nText) continue;
          try {
            const notifMsg = await this.sendWhatsAppAndLog(n.toUserId || null, n.toPhone, nText);
            outgoingNotifications.push(notifMsg);
          } catch (sendErr: any) {
            console.error(`[WhatsAppService] Failed to send notification: ${sendErr.message}`);
            continue;
          }
          if (n.messageType === 'INTERACTIVE_BUTTON' && n.taskId && n.toUserId) {
            const inWindow = await this.isWithinConversationWindow(n.toUserId);
            if (inWindow) {
              try {
                const buttonNotif = await this.sendWhatsAppTaskButtonsAndLog(
                  n.toUserId,
                  n.toPhone,
                  nText,
                  n.taskId
                );
                outgoingNotifications.push(buttonNotif);
              } catch (btnErr: any) {
                console.warn('[WhatsAppService] Buttons follow-up failed:', btnErr.message);
              }
            }
          }
        }
      }

      const outgoing = await this.sendWhatsAppAndLog(senderUser.id, cleanPhone, replyText);
      return {
        status: 'success',
        message: replyText,
        outgoing: [outgoing, ...outgoingNotifications],
        data: {
          task: translation.task,
          notifications: [outgoing, ...(translation.notifications || [])]
        }
      };

    } catch (err: any) {
      console.error('[WhatsAppService] Error during LLM agent processing:', err);

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
