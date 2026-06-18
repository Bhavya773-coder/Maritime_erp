import { env } from '../../config/env';
import prisma from '../../config/db';
import { BotStaffService } from './bot.staff-service';

export interface LlmTranslation {
  isERPRelated: boolean;
  extractedCommand: string | null;
  directResponse: string | null;
  dbOperations?: {
    action: string;
    params: any;
  }[] | null;
}

export class LlmService {
  /**
   * Executes database mutations requested by the AI agent
   */
  public static async executeDbOperations(
    operations: any[],
    senderUserId: string
  ): Promise<string[]> {
    const auditLogs: string[] = [];

    for (const op of operations) {
      try {
        console.log(`[LlmService] Executing DB operation: ${op.action}`, op.params);
        
        switch (op.action) {
          case 'deleteTasks': {
            const { titleContains, status, assigneeName, all } = op.params || {};
            const whereClause: any = { isDeleted: false };
            
            if (!all) {
              if (titleContains) {
                whereClause.title = { contains: titleContains, mode: 'insensitive' };
              }
              if (status) {
                whereClause.status = status;
              }
              if (assigneeName) {
                const candidates = await this.resolveAssigneeName(assigneeName);
                if (candidates.length > 0) {
                  whereClause.assignedToId = { in: candidates.map(c => c.id) };
                }
              }
            }

            const result = await prisma.task.updateMany({
              where: whereClause,
              data: { isDeleted: true, deletedAt: new Date() }
            });

            auditLogs.push(`Deleted ${result.count} tasks matching: ${JSON.stringify(whereClause)}`);
            break;
          }

          case 'createTask': {
            const { title, assigneeName, priority, dueDate } = op.params || {};
            const candidates = await this.resolveAssigneeName(assigneeName);
            
            if (candidates.length === 0) {
              auditLogs.push(`Failed to create task: Could not resolve assignee "${assigneeName}"`);
              break;
            }
            
            const assignee = candidates[0];
            const parsedDueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + 24 * 60 * 60 * 1000);

            const task = await prisma.task.create({
              data: {
                title,
                description: 'Created dynamically by AI agent.',
                taskType: 'ASSIGNED',
                createdById: senderUserId,
                assignedToId: assignee.id,
                dueDate: parsedDueDate,
                priority: priority || 'MEDIUM',
                status: 'PENDING'
              }
            });

            auditLogs.push(`Created task "${task.title}" (ID: ${task.id}) assigned to ${assignee.name}`);
            break;
          }

          case 'updateTask': {
            const { titleContains, taskId, status } = op.params || {};
            const whereClause: any = { isDeleted: false };
            if (taskId) {
              whereClause.id = taskId;
            } else if (titleContains) {
              whereClause.title = { contains: titleContains, mode: 'insensitive' };
            }

            const result = await prisma.task.updateMany({
              where: whereClause,
              data: {
                status,
                completedAt: status === 'COMPLETED' ? new Date() : null
              }
            });

            auditLogs.push(`Updated ${result.count} tasks status to ${status}`);
            break;
          }

          case 'updateVessel': {
            const { name, location } = op.params || {};
            const vessel = await prisma.vessel.findFirst({
              where: { name: { contains: name, mode: 'insensitive' }, deletedAt: null }
            });

            if (!vessel) {
              auditLogs.push(`Failed to update location: Vessel "${name}" not found`);
              break;
            }

            await prisma.$transaction([
              prisma.vessel.update({
                where: { id: vessel.id },
                data: { currentLocation: location }
              }),
              prisma.vesselLocationHistory.create({
                data: {
                  vesselId: vessel.id,
                  location,
                  updatedById: senderUserId
                }
              })
            ]);

            auditLogs.push(`Updated location of vessel "${vessel.name}" to "${location}"`);
            break;
          }

          case 'addStaff': {
            const { name, phone, position } = op.params || {};
            const result = await BotStaffService.addStaff(senderUserId, name, phone, position);
            auditLogs.push(`Add staff operation: ${result}`);
            break;
          }

          default:
            console.warn(`[LlmService] Unknown DB operation: ${op.action}`);
        }
      } catch (err: any) {
        console.error(`[LlmService] Error executing DB operation ${op.action}:`, err);
        auditLogs.push(`Error executing ${op.action}: ${err.message}`);
      }
    }

    // Write to audit log
    if (auditLogs.length > 0) {
      await prisma.auditLog.create({
        data: {
          userId: senderUserId,
          action: 'AI_AGENT_DB_OPERATIONS',
          details: auditLogs.join('\n')
        }
      });
    }

    return auditLogs;
  }

  /**
   * Helper to resolve assignee candidates by name
   */
  private static async resolveAssigneeName(name: string) {
    const activeUsers = await prisma.user.findMany({
      where: { isActive: true }
    });

    const queryLower = name.toLowerCase().trim();
    const queryTokens = queryLower.split(/\s+/).filter(Boolean);

    return activeUsers.filter(user => {
      const userLower = user.name.toLowerCase();
      const userTokens = userLower.split(/\s+/).filter(Boolean);
      return queryTokens.every(qToken => 
        userTokens.some(uToken => uToken.startsWith(qToken))
      );
    });
  }

  /**
   * Retrieves the recent chat history for a sender to provide conversational context.
   */
  private static async getChatHistory(senderUserId: string): Promise<{ role: string; content: string }[]> {
    try {
      const messages = await prisma.botMessage.findMany({
        where: {
          channel: 'WHATSAPP',
          OR: [
            { fromUserId: senderUserId },
            { toUserId: senderUserId }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: 8 // Fetch last 8 messages for context
      });

      // Reverse to chronological order (oldest first)
      const sorted = messages.reverse();

      return sorted.map(m => ({
        role: m.direction === 'INCOMING' ? 'user' : 'assistant',
        content: m.rawText
      }));
    } catch (err) {
      console.error('[LlmService] Error fetching chat history:', err);
      return [];
    }
  }

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
            department: true,
            contacts: {
              where: { channel: 'WHATSAPP', isVerified: true },
              select: { phoneNumber: true }
            }
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
          department: u.department,
          phone: u.contacts.map(c => '+' + c.phoneNumber).join(', ') || 'N/A'
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
  public static async translateMessage(messageText: string, senderUserId: string): Promise<LlmTranslation> {
    if (!env.LLAMA_API_URL) {
      console.log('[LlmService] LLAMA_API_URL is not configured. Skipping LLM translation.');
      return { isERPRelated: true, extractedCommand: messageText, directResponse: null };
    }

    const [dbContext, history] = await Promise.all([
      this.getDatabaseContext(),
      this.getChatHistory(senderUserId)
    ]);

    const systemPrompt = `You are an intelligent natural language translation and query-answering engine for the Arvind Port & Infra Limited Maritime ERP bot.
You are given the active database context (including vessels, staff, and active tasks) as JSON below:

DATABASE CONTEXT:
${dbContext}

Your job is to either:
1. Translate standard action requests (like task assignments, status changes, adding staff) into standard ERP commands.
2. Directly answer general informational queries about the database context (e.g. vessel counts, staff roles, tasks, certificate types like IV/IRS, staff contact/phone numbers).
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
- **Informational Queries**: If the user asks a question about the data in the system (e.g. "how many barges are of IV type", "who is deven", "what is vinit shah's phone number", "what tasks are high priority", "list all barges", etc.), query the DATABASE CONTEXT provided above and answer the question directly. Write your answer in natural, friendly, and professional language, and put it in the "directResponse" field. Set "extractedCommand" to null.
- **Action Commands**: If the user wants to trigger an action (e.g. assign a task, update a location, add staff, or check a specific vessel's location using the standard command), translate their request into the most appropriate standard command and put it in the "extractedCommand" field. Set "directResponse" to null.
- **Off-Topic Refusals**: If the message is a general knowledge question, coding help, writing task, or anything not related to maritime ERP operations or the database context, set "isERPRelated" to false, "extractedCommand" to null, and "directResponse" to null.

You must reply with ONLY a JSON object in this format (no other text):
{
  "isERPRelated": boolean,
  "extractedCommand": string | null,
  "directResponse": string | null,
  "dbOperations": [
    {
      "action": "deleteTasks" | "createTask" | "updateTask" | "updateVessel" | "addStaff",
      "params": object
    }
  ] | null
}

Guidelines for dbOperations:
- If the user wants to mutate data or perform actions (e.g. "delete all that tasks", "create a task to check repairs assigned to hardik", "complete the fuel check task", "update KB 26 location to Mumbai", "add staff Ramesh +919876543210 manager"), select the appropriate database operations and fill the "dbOperations" array.
- Action parameter details:
  1. "deleteTasks":
     - params: { "all": boolean } (set all to true to delete all tasks)
  2. "createTask":
     - params: { "title": string, "assigneeName": string, "priority": "HIGH"|"MEDIUM"|"LOW", "dueDate"?: "YYYY-MM-DD" }
  3. "updateTask":
     - params: { "titleContains": string, "status": "PENDING"|"IN_PROGRESS"|"COMPLETED"|"DELEGATED" } (e.g., to complete a task)
  4. "updateVessel":
     - params: { "name": string, "location": string }
  5. "addStaff":
     - params: { "name": string, "phone": string, "position": string }
- Set "directResponse" to a natural, polite explanation of what you did (e.g., "I have successfully deleted all the active tasks." or "I've assigned the new task to Hardik K.").
- For informational queries (e.g. "how many barges are of IV type"), keep "dbOperations" as null and answer using the "directResponse" field.
- If the user requests an action that translates perfectly to a rigid legacy command and you prefer using it, you can still return "extractedCommand": "command_string" and set "dbOperations" and "directResponse" to null.`;

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
            ...history,
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
        directResponse: parsed.directResponse || null,
        dbOperations: parsed.dbOperations || null
      };

    } catch (err: any) {
      console.error('[LlmService] Exception during LLM query:', err);
      return { isERPRelated: true, extractedCommand: messageText, directResponse: null };
    }
  }
}
