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

            auditLogs.push(`Created task "${task.title}" (ID: ${task.id}) assigned to ${assignee.name}`);

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
   * Uses a compressed pipe-separated value format to reduce token counts for faster inference.
   */
  private static async getDatabaseContext(): Promise<string> {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [vessels, users, tasks, vesselActivity] = await Promise.all([
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
            dueDate: true,
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

      let ctx = 'VESSELS:\n';
      vessels.forEach(v => {
        ctx += `${v.name}|${v.type}|${v.status}|${v.currentLocation}|${v.irsIv || 'N/A'}\n`;
      });

      ctx += '\nSTAFF:\n';
      users.forEach(u => {
        const phone = u.contacts[0]?.phoneNumber ? '+' + u.contacts[0].phoneNumber : 'N/A';
        ctx += `${u.name}|${u.role}|${u.department || 'N/A'}|${phone}\n`;
      });

      ctx += '\nACTIVE TASKS:\n';
      tasks.forEach(t => {
        const assignee = t.assignee?.name || 'Unassigned';
        const due = t.dueDate ? t.dueDate.toISOString().split('T')[0] : 'No due date';
        ctx += `${t.title}|${t.status}|${t.priority}|${assignee}|Due:${due}\n`;
      });

      if (vesselActivity.length > 0) {
        ctx += '\nRECENT VESSEL ACTIVITY (last 7 days):\n';
        vesselActivity.forEach(a => {
          const date = a.createdAt.toISOString().split('T')[0];
          ctx += `${a.vessel.name}|${a.activityType}|${a.summary}|${date}\n`;
        });
      }

      return ctx;
    } catch (err) {
      console.error('[LlmService] Error fetching database context:', err);
      return '';
    }
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

    const systemPrompt = `You are the Arvind Port & Infra Limited Maritime ERP assistant on WhatsApp.
Current user: ${senderUserName} (ID: ${senderUserId}, Role: ${senderUserRole}).

DATABASE CONTEXT:
${dbContext}

═══════════════════════════════════════════════════════
CRITICAL RULES — STRICT MODE — READ CAREFULLY
═══════════════════════════════════════════════════════

RULE 1 — TASK CREATION:
When the user explicitly asks to assign, create, or request someone to do something (e.g. "tell X to do Y", "assign a task to X to do Y", "X needs to do Y"):
  - Create the task in the database using the "createTask" operation.
  - The task parameters MUST contain:
    (a) An explicit ASSIGNEE name (a person from the STAFF list)
    (b) An explicit ACTION / DESCRIPTION (what to do)
  - If dueDate is missing, default to tomorrow or ask: "What is the deadline for this task?"
  - If assignee or action is missing, ask the user to clarify.

RULE 2 — NEVER CREATE TASKS FROM CASUAL CONVERSATION:
ABSOLUTELY DO NOT create tasks from:
  - Casual replies like "I don't have money", "OK", "Yes", "Sure", "Thanks", "Hello"
  - Complaints or status updates like "I haven't done it yet", "It's raining"
  - Questions like "What time is lunch?", "How are you?"
  - Forwarded messages, jokes, or random text
  - Anything that is NOT a direct explicit command to assign/create a task
If in doubt, treat the message as conversation and reply naturally. DO NOT guess intent.

RULE 3 — CONFIRMATIONS ("Yes", "OK", "Sure"):
Only treat these as continuation of a PENDING question from chat history (e.g., confirming a deadline you asked about). If there is no pending question, just reply conversationally.
NEVER interpret "Yes" or "OK" as a standalone task creation command.

RULE 4 — INFORMATIONAL QUERIES:
Answer questions about the database directly from the context above (vessels, staff, tasks, vessel activity).
Examples: "who is Deven?", "where is KB 26?", "what's happening with Arcadia this week?", "how many barges?", "what are my tasks?", "what are Hardik's tasks?"
For personal task queries ("my tasks"), filter ACTIVE TASKS where assignee matches "${senderUserName}".
For vessel history queries ("what's happening with KB 26"), use the RECENT VESSEL ACTIVITY section.

RULE 5 — VESSEL ACTIVITY LOGGING:
If someone mentions a vessel and provides useful information about it (e.g., "KB 26 has reached Mumbai", "Arcadia engine needs repair"), log it using the "logVesselActivity" operation. But ONLY for meaningful updates — not casual mentions.

RULE 6 — OFF-TOPIC:
General knowledge, coding help, or non-ERP questions: set isERPRelated to false.

RULE 7 — TASK UPDATES & REASONS:
If a user replies to a task with a status update, issue, or reason (e.g., "I don't have funds", "The part is missing", "Done but waiting for approval"), YOU MUST use the "updateTask" operation and put their exact reason in the "note" field so the creator is notified of WHY it is pending or updated.

═══════════════════════════════════════════════════════
RESPONSE FORMAT — JSON ONLY
═══════════════════════════════════════════════════════

Reply with ONLY this JSON (no extra text):
{
  "isERPRelated": boolean,
  "directResponse": string | null,
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

IMPORTANT:
- For actions, set "directResponse" to a brief confirmation of what you did.
- For informational queries, set "dbOperations" to null and answer in "directResponse".
- For casual conversation, set "dbOperations" to null and reply naturally in "directResponse".
- NEVER fabricate data. If info is not in the context, say "I don't have that information."
- When the user's message does NOT match explicit commands or queries, ALWAYS default to a conversational reply in "directResponse" with NO dbOperations.`;

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
        return { isERPRelated: true, directResponse: null };
      }

      const resJson: any = await response.json();
      const rawContent = resJson.message?.content || '';
      
      console.log(`[LlmService] Raw response content: "${rawContent}"`);

      // Clean response to parse JSON reliably (extract text between first '{' and last '}')
      const match = rawContent.match(/\{[\s\S]*\}/);
      if (!match) {
        console.warn('[LlmService] Failed to extract JSON block from LLM response.');
        return { isERPRelated: true, directResponse: null };
      }

      const parsed = JSON.parse(match[0]) as LlmTranslation;
      return {
        isERPRelated: typeof parsed.isERPRelated === 'boolean' ? parsed.isERPRelated : true,
        directResponse: parsed.directResponse || null,
        dbOperations: parsed.dbOperations || null
      };

    } catch (err: any) {
      console.error('[LlmService] Exception during LLM query:', err);
      return { isERPRelated: true, directResponse: null };
    }
  }
}
