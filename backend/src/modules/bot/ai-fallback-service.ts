import prisma from '../../config/db';
import { Role } from '@prisma/client';
import { BotService } from './bot.service';
import { BotReplyParser, ReplyCommand } from './bot.reply-parser';
import { BotParser } from './bot.parser';
import { BotReplyService } from './bot.reply-service';
import { BotFleetParser } from './bot.fleet-parser';
import { BotFleetService } from './bot.fleet-service';
import { BotDocumentParser } from './bot.document-parser';
import { BotDocumentService } from './bot.document-service';

export class AiFallbackService {
  /**
   * When the AI service is unavailable, try to handle the message using
   * legacy regex parsers and template responses.
   */
  public static async handleFallback(
    text: string,
    sender: { id: string; name: string; role: Role },
    fromPhone: string
  ): Promise<{ status: string; message: string }> {
    const cleanText = text.trim();
    const lower = cleanText.toLowerCase();

    // 1. Try legacy reply parser (DONE, UPDATE, STATUS, DELEGATE, HELP)
    const replyCommand = BotReplyParser.parse(text);
    if (replyCommand) {
      try {
        const result = await BotReplyService.executeReplyCommand(sender as any, replyCommand, fromPhone);
        return { status: result.status, message: result.message };
      } catch (err: any) {
        console.error('[AiFallbackService] Reply service error:', err);
      }
    }

    // 2. Try fleet parser
    const fleetQuery = BotFleetParser.parse(text);
    if (fleetQuery) {
      try {
        const replyText = await BotFleetService.executeQuery(fleetQuery, sender.id);
        return { status: 'success', message: replyText };
      } catch (err: any) {
        console.error('[AiFallbackService] Fleet service error:', err);
      }
    }

    // 3. Try document parser
    const docQuery = BotDocumentParser.parse(text);
    if (docQuery) {
      try {
        if (docQuery.type === 'LIST_DOCUMENTS') {
          const replyText = await BotDocumentService.listAllDocuments(docQuery.docType!);
          return { status: 'success', message: replyText };
        }
        const result = await BotDocumentService.getDocumentRecord(docQuery.vesselName!, docQuery.docType!);
        if (result && result.doc) {
          const replyText = `📄 ${result.doc.fileName}\n🔗 ${result.url}`;
          return { status: 'success', message: replyText };
        }
        return { status: 'success', message: `Document not found for ${docQuery.vesselName}.` };
      } catch (err: any) {
        console.error('[AiFallbackService] Document service error:', err);
      }
    }

    // 4. Try legacy bot parser (task creation)
    const parsed = BotParser.parse(text);
    if (parsed && parsed.assigneeName) {
      try {
        const result = await BotService.processCommand(text, sender as any, {
          channel: 'WHATSAPP' as any,
          fromPhone,
        });
        return { status: result.status, message: result.message };
      } catch (err: any) {
        console.error('[AiFallbackService] Bot service error:', err);
      }
    }

    // 5. Default template response
    return {
      status: 'error',
      message: `I'm sorry, I'm having trouble processing your request right now. Please try again later, or contact the office directly.`,
    };
  }
}
