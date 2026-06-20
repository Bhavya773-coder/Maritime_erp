import { env } from '../../config/env';
import prisma from '../../config/db';
import { BotStaffService } from './bot.staff-service';

export interface LlmTranslation {
  isERPRelated: boolean;
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
    senderUserId: string,
    senderUserName: string
  ): Promise<{ auditLogs: string[]; notifications: any[] }> {
    const auditLogs: string[] = [];
    const notifications: any[] = [];

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
            let parsedDueDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Default to tomorrow
            if (dueDate) {
              const d = new Date(dueDate);
              if (!isNaN(d.getTime())) {
                parsedDueDate = d;
              } else {
                const lowerDue = String(dueDate).toLowerCase().trim();
                if (lowerDue.includes('today')) {
                  parsedDueDate = new Date();
                }
              }
            }

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

            auditLogs.push(`Created task "${task.title}" (ID: ${task.id}) assigned to ${assignee.name}, due ${parsedDueDate.toISOString().split('T')[0]}`);

            // Auto-detect vessel mentions and log activity
            const allVessels = await prisma.vessel.findMany({ where: { deletedAt: null }, select: { id: true, name: true } });
            for (const v of allVessels) {
              if (task.title.toLowerCase().includes(v.name.toLowerCase())) {
                await prisma.vesselActivityLog.create({
                  data: {
                    vesselId: v.id,
                    activityType: 'TASK_ASSIGNED',
                    summary: `Task "${task.title}" assigned to ${assignee.name} by ${senderUserName}`,
                    relatedTaskId: task.id,
                    reportedById: senderUserId
                  }
                });
                auditLogs.push(`Logged vessel activity for "${v.name}" (task reference)`);
              }
            }

            // Create BotReminder
            const nextReminderAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
            await prisma.botReminder.create({
              data: {
                taskId: task.id,
                assignedToId: assignee.id,
                reminderType: 'TASK_PENDING',
                frequencyHours: 24,
                nextReminderAt,
                status: 'ACTIVE'
              }
            });

            // Find WhatsApp contact of assignee to send notification
            const assigneeContact = await prisma.userContact.findFirst({
              where: { userId: assignee.id, channel: 'WHATSAPP' }
            });

            if (assigneeContact) {
              const rawText = `New task from ${senderUserName}: ${task.title}. Priority: ${task.priority}. Due: ${task.dueDate.toISOString().split('T')[0]}.`;
              notifications.push({
                toUserId: assignee.id,
                toPhone: assigneeContact.phoneNumber,
                rawText,
                messageType: 'INTERACTIVE_BUTTON',
                taskId: task.id
              });
            }
            break;
          }

          case 'updateTask': {
            const { titleContains, taskId, status, assigneeName, note } = op.params || {};
            const whereClause: any = { isDeleted: false };
            if (taskId) {
              whereClause.id = taskId;
            } else if (titleContains) {
              whereClause.title = { contains: titleContains, mode: 'insensitive' };
            }

            const tasksToUpdate = await prisma.task.findMany({
              where: whereClause,
              include: { creator: true }
            });

            if (status === 'DELEGATED' && assigneeName) {
              const candidates = await this.resolveAssigneeName(assigneeName);
              if (candidates.length > 0) {
                const assignee = candidates[0];
                for (const t of tasksToUpdate) {
                  // Update task assignee and status to DELEGATED
                  await prisma.task.update({
                    where: { id: t.id },
                    data: {
                      assignedToId: assignee.id,
                      status: 'DELEGATED'
                    }
                  });

                  // Update related ACTIVE BotReminders to point to the new assignee
                  await prisma.botReminder.updateMany({
                    where: { taskId: t.id, status: 'ACTIVE' },
                    data: { assignedToId: assignee.id }
                  });

                  // Create delegation log
                  const currentAssigneeId = t.assignedToId || t.createdById;
                  await prisma.taskDelegationLog.create({
                    data: {
                      taskId: t.id,
                      fromUserId: currentAssigneeId,
                      toUserId: assignee.id,
                      note: note || 'Delegated via AI agent.'
                    }
                  });

                  // Find WhatsApp contact of assignee to send notification
                  const assigneeContact = await prisma.userContact.findFirst({
                    where: { userId: assignee.id, channel: 'WHATSAPP' }
                  });

                  if (assigneeContact) {
                    const rawText = `New task delegated to you by ${senderUserName}: ${t.title}. Note: ${note || 'Delegated'}`;
                    notifications.push({
                      toUserId: assignee.id,
                      toPhone: assigneeContact.phoneNumber,
                      rawText,
                      messageType: 'INTERACTIVE_BUTTON',
                      taskId: t.id
                    });
                  }

                  // Notify creator
                  const creatorContact = await prisma.userContact.findFirst({
                    where: { userId: t.createdById, channel: 'WHATSAPP' }
                  });
                  if (creatorContact && t.createdById !== senderUserId) {
                    const rawText = `${senderUserName} delegated task "${t.title}" to ${assignee.name}. Note: ${note || 'Delegated'}`;
                    notifications.push({
                      toUserId: t.createdById,
                      toPhone: creatorContact.phoneNumber,
                      rawText,
                      messageType: 'TEXT'
                    });
                  }
                }
                auditLogs.push(`Delegated ${tasksToUpdate.length} tasks to ${assignee.name}`);
              } else {
                auditLogs.push(`Failed to delegate: Could not resolve assignee "${assigneeName}"`);
              }
            } else {
              const result = await prisma.task.updateMany({
                where: whereClause,
                data: {
                  status,
                  completedAt: status === 'COMPLETED' ? new Date() : null
                }
              });

              // Mark related BotReminders COMPLETED if task is completed
              if (status === 'COMPLETED') {
                await prisma.botReminder.updateMany({
                  where: {
                    taskId: { in: tasksToUpdate.map(t => t.id) },
                    status: 'ACTIVE'
                  },
                  data: { status: 'COMPLETED' }
                });
              }

              // Save the note as a TaskComment so it's not lost
              if (note) {
                for (const t of tasksToUpdate) {
                  await prisma.taskComment.create({
                    data: {
                      taskId: t.id,
                      userId: senderUserId,
                      content: note
                    }
                  });
                }
              }

              // Generate notification to the creator of the task (acknowledgement)
              for (const t of tasksToUpdate) {
                const creatorContact = await prisma.userContact.findFirst({
                  where: { userId: t.createdById, channel: 'WHATSAPP' }
                });
                if (creatorContact && t.createdById !== senderUserId) {
                  // Include the note/reason in the creator notification
                  const noteText = note ? `\nReason: ${note}` : '';
                  const rawText = `${senderUserName} updated task "${t.title}" → ${status}.${noteText}`;
                  notifications.push({
                    toUserId: t.createdById,
                    toPhone: creatorContact.phoneNumber,
                    rawText,
                    messageType: 'TEXT'
                  });
                }
              }

              auditLogs.push(`Updated ${result.count} tasks status to ${status}${note ? ' (Note: ' + note + ')' : ''}`);
            }
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

          case 'logVesselActivity': {
            const { vesselName, activityType, summary } = op.params || {};
            if (!vesselName || !summary) {
              auditLogs.push(`Failed to log vessel activity: Missing vesselName or summary`);
              break;
            }

            const vessel = await prisma.vessel.findFirst({
              where: { name: { contains: vesselName, mode: 'insensitive' }, deletedAt: null }
            });

            if (!vessel) {
              auditLogs.push(`Failed to log vessel activity: Vessel "${vesselName}" not found`);
              break;
            }

            await prisma.vesselActivityLog.create({
              data: {
                vesselId: vessel.id,
                activityType: activityType || 'CONVERSATION_MENTION',
                summary,
                reportedById: senderUserId
              }
            });

            auditLogs.push(`Logged activity for vessel "${vessel.name}": ${summary}`);
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

    return { auditLogs, notifications };
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
   * Fetches 20 messages (both user and bot) to maintain deep context.
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
        take: 20 // Fetch last 20 messages for deep context
      });

      // Reverse to chronological order (oldest first)
      const sorted = messages.reverse();

      return sorted
        .filter(m => {
          // Filter out internal notification messages (task buttons, template texts)
          // Keep only actual conversational messages
          if (m.direction === 'OUTGOING') {
            // Skip notification messages sent to OTHER users
            if (m.toUserId && m.toUserId !== senderUserId) return false;
            // Skip interactive button messages (they are task notifications)
            if (m.messageType === 'INTERACTIVE_BUTTON') return false;
            // Skip template messages
            if (m.messageType === 'TEMPLATE') return false;
          }
          return true;
        })
        .map(m => ({
          role: m.direction === 'INCOMING' ? 'user' : 'assistant',
          content: m.rawText
        }));
    } catch (err) {
      console.error('[LlmService] Error fetching chat history:', err);
      return [];
    }
  }

  /**
   * Fetches comprehensive database records to feed to the LLM context.
   * Provides FULL details so the LLM can generate rich, detailed answers.
   */
  private static async getDatabaseContext(): Promise<string> {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [vessels, users, tasks, vesselActivity] = await Promise.all([
        prisma.vessel.findMany({
          where: { deletedAt: null },
          select: {
            name: true,
            registrationNo: true,
            type: true,
            status: true,
            currentLocation: true,
            classification: true,
            buildYear: true,
            length: true,
            breadth: true,
            depth: true,
            irsIv: true,
            remark: true
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
            description: true,
            status: true,
            priority: true,
            dueDate: true,
            createdAt: true,
            creator: { select: { name: true } },
            assignee: { select: { name: true } }
          }
        }),
        prisma.vesselActivityLog.findMany({
          where: { createdAt: { gte: sevenDaysAgo } },
          select: {
            vessel: { select: { name: true } },
            activityType: true,
            summary: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 25
        })
      ]);

      let ctx = '=== VESSELS (Fleet) ===\n';
      ctx += `Total vessels: ${vessels.length}\n\n`;
      vessels.forEach((v, i) => {
        ctx += `${i + 1}. ${v.name}\n`;
        ctx += `   Type: ${v.type} | Status: ${v.status} | Location: ${v.currentLocation}\n`;
        ctx += `   Registration: ${v.registrationNo}`;
        if (v.classification) ctx += ` | Class: ${v.classification}`;
        if (v.irsIv) ctx += ` | IRS/IV: ${v.irsIv}`;
        if (v.buildYear) ctx += ` | Built: ${v.buildYear}`;
        ctx += '\n';
        if (v.length || v.breadth || v.depth) {
          ctx += `   Dimensions: ${v.length || '?'}m × ${v.breadth || '?'}m × ${v.depth || '?'}m\n`;
        }
        if (v.remark) ctx += `   Remark: ${v.remark}\n`;
        ctx += '\n';
      });

      ctx += '=== STAFF (Active Employees) ===\n';
      ctx += `Total staff: ${users.length}\n\n`;
      users.forEach((u, i) => {
        const phone = u.contacts[0]?.phoneNumber ? '+' + u.contacts[0].phoneNumber : 'No phone';
        ctx += `${i + 1}. ${u.name} | Role: ${u.role} | Dept: ${u.department || 'N/A'} | Phone: ${phone}\n`;
      });

      ctx += '\n=== ACTIVE TASKS (Not Completed) ===\n';
      ctx += `Total active tasks: ${tasks.length}\n\n`;
      if (tasks.length === 0) {
        ctx += 'No active tasks currently.\n';
      } else {
        tasks.forEach((t, i) => {
          const assignee = t.assignee?.name || 'Unassigned';
          const creator = t.creator?.name || 'Unknown';
          const due = t.dueDate ? t.dueDate.toISOString().split('T')[0] : 'No due date';
          const created = t.createdAt ? t.createdAt.toISOString().split('T')[0] : 'Unknown';
          ctx += `${i + 1}. "${t.title}"\n`;
          ctx += `   Status: ${t.status} | Priority: ${t.priority} | Due: ${due}\n`;
          ctx += `   Assigned to: ${assignee} | Created by: ${creator} | Created: ${created}\n`;
          if (t.description && t.description !== 'Created dynamically by AI agent.') {
            ctx += `   Description: ${t.description}\n`;
          }
          ctx += '\n';
        });
      }

      if (vesselActivity.length > 0) {
        ctx += '=== RECENT VESSEL ACTIVITY (last 7 days) ===\n\n';
        vesselActivity.forEach(a => {
          const date = a.createdAt.toISOString().split('T')[0];
          ctx += `• ${a.vessel.name} — ${a.activityType}: ${a.summary} (${date})\n`;
        });
      }

      return ctx;
    } catch (err) {
      console.error('[LlmService] Error fetching database context:', err);
      return '';
    }
  }

  /**
   * Build the system prompt for the AI assistant.
   */
  private static buildSystemPrompt(
    dbContext: string,
    senderUserName: string,
    senderUserId: string,
    senderUserRole: string
  ): string {
    const today = new Date().toISOString().split('T')[0];

    return `You are the intelligent AI assistant for Arvind Port & Infra Limited (APIL), a maritime company. You operate on WhatsApp.
You are chatting with: ${senderUserName} (Role: ${senderUserRole}).
Today's date: ${today}

COMPANY DATABASE:
${dbContext}

════════════════════════════════════════════════
YOUR PERSONALITY & BEHAVIOR
════════════════════════════════════════════════

You are a smart, helpful, and conversational assistant. You can:
• Chat naturally and respond to greetings, questions, and casual conversation
• Answer questions about vessels, staff, tasks, and company operations using the database
• Create tasks, update tasks, delegate tasks, and manage company operations
• Summarize ongoing work, list detailed information, and provide insights
• Remember context from the conversation history (previous messages are provided to you)

GOLDEN RULES:
1. ALWAYS provide a complete, natural, human-readable answer in "directResponse". NEVER leave it null or empty.
2. When listing items (vessels, tasks, staff), include ALL relevant details — names, types, statuses, locations, dates, etc.
3. When the user says "and?" or "what else?" or asks a follow-up, look at the conversation history and continue from where you left off.
4. Be conversational and friendly. You are a personal assistant, not a robot.
5. If you created a task, confirm it with full details: who it's assigned to, the title, due date, priority.

════════════════════════════════════════════════
TASK CREATION RULES
════════════════════════════════════════════════

When the user explicitly asks to assign, create, or request someone to do something:
• Extract the ASSIGNEE (person name from STAFF list)
• Extract the TASK/ACTION (what to do)
• If dueDate is not mentioned, default to tomorrow (${new Date(Date.now() + 86400000).toISOString().split('T')[0]})
• Match assignee names flexibly — "hardik k" matches "Hardik Kateshiya", "deven" matches "Deven Patel", etc.
• IMPORTANT: Even poorly worded requests like "ask hardik k to bring waterbottel in my office rn" should be understood and create a task with title "Bring Water Bottle" assigned to the matching person.

DO NOT create tasks from:
• Casual replies: "OK", "yes", "sure", "thanks", "hello"
• Complaints or status updates: "I don't have money", "it's raining"
• Questions: "what time is lunch?", "how are you?"

════════════════════════════════════════════════
RESPONSE FORMAT — JSON ONLY
════════════════════════════════════════════════

Reply with ONLY this JSON (no extra text):
{
  "isERPRelated": boolean,
  "directResponse": "YOUR COMPLETE NATURAL LANGUAGE ANSWER HERE — NEVER null",
  "dbOperations": [
    {
      "action": "deleteTasks" | "createTask" | "updateTask" | "updateVessel" | "addStaff" | "logVesselActivity",
      "params": object
    }
  ] | null
}

dbOperations parameter details:
1. "deleteTasks": { "all": boolean, "titleContains"?: string }
2. "createTask": { "title": string, "assigneeName": string, "priority": "HIGH"|"MEDIUM"|"LOW", "dueDate"?: "YYYY-MM-DD" }
3. "updateTask": { "titleContains": string, "status": "PENDING"|"IN_PROGRESS"|"COMPLETED"|"DELEGATED", "assigneeName"?: string, "note"?: string }
4. "updateVessel": { "name": string, "location": string }
5. "addStaff": { "name": string, "phone": string, "position": string }
6. "logVesselActivity": { "vesselName": string, "activityType": "TASK_ASSIGNED"|"TASK_COMPLETED"|"LOCATION_UPDATE"|"STATUS_UPDATE"|"CONVERSATION_MENTION", "summary": string }

CRITICAL RULES:
• For mutations (create/update/delete), set BOTH "directResponse" AND "dbOperations".
  Example directResponse after creating task: "Done! I've assigned the task 'Bring Water Bottle' to Hardik Kateshiya with MEDIUM priority, due ${new Date(Date.now() + 86400000).toISOString().split('T')[0]}. He'll be notified on WhatsApp."
• For questions/queries (listing vessels, checking tasks, asking about staff), set "dbOperations" to null and answer fully in "directResponse".
• NEVER invent custom dbOperations (no "showVessels", "listVessels", "filterVessels", "query"). If the user asks a question, answer it directly.
• NEVER fabricate data. If info is not in the database context, say "I don't have that information in the system."
• isERPRelated should be true for: tasks, vessels, staff, company queries, office chores, greetings, and anything that could be related to work.
• isERPRelated should be false ONLY for: coding help, math homework, general knowledge questions completely unrelated to work.

════════════════════════════════════════════════
EXAMPLES OF GOOD RESPONSES
════════════════════════════════════════════════

User: "list all barges with details"
Good directResponse: "Here are all the barges in our fleet:\n\n1. KB 18 (ARCADEIA ADINATH)\n   Type: BARGE | Status: ACTIVE | Location: Mumbai\n   Registration: MH-1234 | IRS/IV: IV | Built: 2015\n   Dimensions: 60m × 15m × 4m\n\n2. ARCADIA VARUN\n   Type: BARGE | Status: ACTIVE | Location: Hazira\n   ..."
Bad directResponse: "We have 17 barges." (too brief, no details)

User: "how many tasks are pending?" then "who assigned them?"
Good directResponse: "Here are the pending tasks with assignee details:\n\n1. 'Bring Water Bottle' — Assigned to Hardik Kateshiya by Bhavya, due 2026-06-21\n2. 'Engine Inspection' — Assigned to Deven by Bhavya, due 2026-06-25"
Bad directResponse: "Hardik Kateshiya" (missing context, incomplete)

User: "hi"
Good directResponse: "Hello ${senderUserName}! 👋 How can I help you today? I can assist with tasks, vessel information, staff queries, or anything else you need."
Bad directResponse: null or "I have processed your request."`;
  }

  /**
   * Translates natural language message to standard bot command or answers directly from database context.
   */
  public static async translateMessage(
    messageText: string,
    senderUserId: string,
    senderUserName: string,
    senderUserRole: string
  ): Promise<LlmTranslation> {
    if (!env.LLAMA_API_URL) {
      console.log('[LlmService] LLAMA_API_URL is not configured. Skipping LLM translation.');
      return { isERPRelated: true, directResponse: null };
    }

    const [dbContext, history] = await Promise.all([
      this.getDatabaseContext(),
      this.getChatHistory(senderUserId)
    ]);

    const systemPrompt = this.buildSystemPrompt(dbContext, senderUserName, senderUserId, senderUserRole);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (env.LLAMA_API_KEY) {
      headers['Authorization'] = `Bearer ${env.LLAMA_API_KEY}`;
    }

    try {
      console.log(`[LlmService] Sending to LLM with ${history.length} history messages`);

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
            temperature: 0.2
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[LlmService] Ollama API error: ${response.status} - ${errText}`);
        return { isERPRelated: true, directResponse: 'Sorry, I encountered an error processing your request. Please try again.' };
      }

      const resJson: any = await response.json();
      const rawContent = resJson.message?.content || '';
      
      console.log(`[LlmService] Raw response content: "${rawContent.substring(0, 300)}..."`);

      // Clean response to parse JSON reliably (extract text between first '{' and last '}')
      const match = rawContent.match(/\{[\s\S]*\}/);
      if (!match) {
        console.warn('[LlmService] Failed to extract JSON block from LLM response. Using raw text as response.');
        // If LLM didn't return JSON, use the raw text as the response
        return {
          isERPRelated: true,
          directResponse: rawContent.trim() || 'I understood your message but had trouble formatting my response. Could you please rephrase?'
        };
      }

      const parsed = JSON.parse(match[0]) as LlmTranslation;
      
      // SAFETY NET: Ensure directResponse is never null or empty
      let directResponse = parsed.directResponse;
      if (!directResponse || directResponse.trim() === '' || directResponse === 'null') {
        // If LLM returned operations but no response, build a confirmation from audit logs
        if (parsed.dbOperations && parsed.dbOperations.length > 0) {
          const ops = parsed.dbOperations;
          const summaries: string[] = [];
          for (const op of ops) {
            if (op.action === 'createTask') {
              summaries.push(`I've created the task "${op.params.title}" and assigned it to ${op.params.assigneeName}. They'll be notified on WhatsApp.`);
            } else if (op.action === 'updateTask') {
              summaries.push(`I've updated the task "${op.params.titleContains || 'matching task'}" to status: ${op.params.status}.`);
            } else if (op.action === 'deleteTasks') {
              summaries.push(`I've deleted the requested tasks.`);
            } else if (op.action === 'updateVessel') {
              summaries.push(`I've updated the location of ${op.params.name} to ${op.params.location}.`);
            } else {
              summaries.push(`I've processed your ${op.action} request.`);
            }
          }
          directResponse = summaries.join('\n');
        } else {
          directResponse = 'I understood your message but could not generate a proper response. Could you please rephrase your question?';
        }
      }

      return {
        isERPRelated: typeof parsed.isERPRelated === 'boolean' ? parsed.isERPRelated : true,
        directResponse,
        dbOperations: parsed.dbOperations || null
      };

    } catch (err: any) {
      console.error('[LlmService] Exception during LLM query:', err);
      return { isERPRelated: true, directResponse: 'Sorry, I encountered a connection error. Please try again in a moment.' };
    }
  }
}
