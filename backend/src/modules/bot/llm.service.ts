import { env } from '../../config/env';
import prisma from '../../config/db';

export interface LlmTranslation {
  isERPRelated: boolean;
  extractedCommand: string | null;
  directResponse: string | null;
}

export class LlmService {
  /**
   * Fetches active database records to feed to the LLM context.
   */
  private static async getDatabaseContext(): Promise<string> {
    try {
      const [vessels, users, tasks] = await Promise.all([
        prisma.vessel.findMany({
          where: { deletedAt: null },
          select: {
            name: true,
            type: true,
            status: true,
            currentLocation: true,
            irsIv: true
          }
        }),
        prisma.user.findMany({
          where: { isActive: true },
          select: {
            name: true,
            role: true,
            department: true
          }
        }),
        prisma.task.findMany({
          where: { isDeleted: false, status: { not: 'COMPLETED' } },
          select: {
            title: true,
            status: true,
            priority: true,
            assignee: { select: { name: true } }
          }
        })
      ]);

      return JSON.stringify({
        vessels: vessels.map(v => ({
          name: v.name,
          type: v.type, // BARGE or TUG
          status: v.status,
          location: v.currentLocation,
          irsIv: v.irsIv // "IV" or "IRS"
        })),
        staff: users.map(u => ({
          name: u.name,
          role: u.role,
          department: u.department
        })),
        activeTasks: tasks.map(t => ({
          title: t.title,
          status: t.status,
          priority: t.priority,
          assignee: t.assignee?.name || 'Unassigned'
        }))
      });
    } catch (err) {
      console.error('[LlmService] Error fetching database context:', err);
      return '{}';
    }
  }

  /**
   * Translates natural language message to standard bot command or answers directly from database context.
   */
  public static async translateMessage(messageText: string): Promise<LlmTranslation> {
    if (!env.LLAMA_API_URL) {
      console.log('[LlmService] LLAMA_API_URL is not configured. Skipping LLM translation.');
      return { isERPRelated: true, extractedCommand: messageText, directResponse: null };
    }

    const dbContext = await this.getDatabaseContext();

    const systemPrompt = `You are an intelligent natural language translation and query-answering engine for the Arvind Port & Infra Limited Maritime ERP bot.
You are given the active database context (including vessels, staff, and active tasks) as JSON below:

DATABASE CONTEXT:
${dbContext}

Your job is to either:
1. Translate standard action requests (like task assignments, status changes, adding staff) into standard ERP commands.
2. Directly answer general informational queries about the database context (e.g. vessel counts, staff roles, tasks, certificate types like IV/IRS).
3. Flag off-topic/unrelated questions.

Available standard bot commands (for action requests):
1. Task Assignment:
   - Format: "Tell/Ask/Remind <Name> to <Action>" (e.g. "Tell Hardik K to check the fuel")
   - Keywords/contexts: "tomorrow", "today", "monday", "urgent", "high", "low"
2. Vessel Queries & Location Updates:
   - Format: "where is <Vessel Name>" (e.g. "where is KB 26")
   - Format: "list barges", "list tugs", "list in port", "list maintenance", "list all"
   - Format: "Update <Vessel Name> location to <Location>" (e.g. "Update KB 26 location to Mumbai")
3. Staff Queries & Updates:
   - Format: "staff list" or "how many members"
   - Format: "ag staff" or "list ag staff"
   - Format: "owners" or "list owners"
   - Format: "Add staff <Name> <Number> <Position>" (e.g. "Add staff Ramesh +919876543210 ag staff")
4. Task Management Replies:
   - Format: "DONE" (optionally with task ID, e.g. "DONE 123e4567-...")
   - Format: "UPDATE: <message>" (e.g. "UPDATE: check complete")
   - Format: "DELEGATE: <Name> - <Note>"
   - Format: "STATUS"
   - Format: "HELP"

Guidelines:
- **Informational Queries**: If the user asks a question about the data in the system (e.g. "how many barges are of IV type", "who is deven", "what tasks are high priority", "list all barges", etc.), query the DATABASE CONTEXT provided above and answer the question directly. Write your answer in natural, friendly, and professional language, and put it in the "directResponse" field. Set "extractedCommand" to null.
- **Action Commands**: If the user wants to trigger an action (e.g. assign a task, update a location, add staff, or check a specific vessel's location using the standard command), translate their request into the most appropriate standard command and put it in the "extractedCommand" field. Set "directResponse" to null.
- **Off-Topic Refusals**: If the message is a general knowledge question, coding help, writing task, or anything not related to maritime ERP operations or the database context, set "isERPRelated" to false, "extractedCommand" to null, and "directResponse" to null.

You must reply with ONLY a JSON object in this format (no other text):
{
  "isERPRelated": boolean,
  "extractedCommand": string | null,
  "directResponse": string | null
}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (env.LLAMA_API_KEY) {
      headers['Authorization'] = `Bearer ${env.LLAMA_API_KEY}`;
    }

    try {
      const response = await fetch(env.LLAMA_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: env.LLAMA_MODEL_NAME,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: messageText }
          ],
          stream: false,
          format: 'json',
          options: {
            temperature: 0.1
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[LlmService] Ollama API error: ${response.status} - ${errText}`);
        return { isERPRelated: true, extractedCommand: messageText, directResponse: null };
      }

      const resJson: any = await response.json();
      const rawContent = resJson.message?.content || '';
      
      console.log(`[LlmService] Raw response content: "${rawContent}"`);

      // Clean response to parse JSON reliably (extract text between first '{' and last '}')
      const match = rawContent.match(/\{[\s\S]*\}/);
      if (!match) {
        console.warn('[LlmService] Failed to extract JSON block from LLM response.');
        return { isERPRelated: true, extractedCommand: messageText, directResponse: null };
      }

      const parsed = JSON.parse(match[0]) as LlmTranslation;
      return {
        isERPRelated: typeof parsed.isERPRelated === 'boolean' ? parsed.isERPRelated : true,
        extractedCommand: parsed.extractedCommand || null,
        directResponse: parsed.directResponse || null
      };

    } catch (err: any) {
      console.error('[LlmService] Exception during LLM query:', err);
      return { isERPRelated: true, extractedCommand: messageText, directResponse: null };
    }
  }
}
