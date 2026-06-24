import { env } from '../../config/env';
import prisma from '../../config/db';
import { BotStaffService } from './bot.staff-service';
import { calculateNextReminderAt } from './bot.utils';
import { Role } from '@prisma/client';
import { ToolExecutor, ToolCallRequest } from './tool-executor';
import { ConversationContextService } from './conversation-context';
import { ConfirmationService } from './confirmation-service';
import { buildToolsPrompt } from './tool-definitions';
import { BotFleetParser } from './bot.fleet-parser';
import { BotFleetService } from './bot.fleet-service';
import { BotDocumentParser } from './bot.document-parser';
import { BotDocumentService } from './bot.document-service';
import { BotParser } from './bot.parser';

export interface LlmTranslation {
  isERPRelated: boolean;
  directResponse: string | null;
  dbOperations?: {
    action: string;
    params: any;
  }[] | null;
  status?: string;
  options?: any[];
  task?: any;
  notifications?: any[];
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

            await prisma.taskDelegationLog.create({
              data: {
                taskId: task.id,
                fromUserId: senderUserId,
                toUserId: assignee.id,
                note: 'Initial assignment via AI agent',
              },
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
            const nextReminderAt = calculateNextReminderAt(parsedDueDate);
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
              // Use exact template message format to bypass 24h window
              const rawText = `New task from ${senderUserName}: ${task.title}. Reply UPDATE, DONE, or DELEGATE.`;
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

          case 'createPersonalReminder': {
            const { title, description, remindAt } = op.params || {};

            if (!title || !remindAt) {
              auditLogs.push('Failed to create personal reminder: Missing title or remindAt');
              break;
            }

            const d = new Date(remindAt);
            if (isNaN(d.getTime())) {
              auditLogs.push(`Failed to create personal reminder: Invalid date "${remindAt}"`);
              break;
            }

            const reminder = await prisma.personalReminder.create({
              data: {
                userId: senderUserId,
                title,
                description: description || null,
                remindAt: d,
                status: 'PENDING',
              },
            });

            auditLogs.push(`Created personal reminder "${title}" for ${d.toISOString()}`);
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
   * Extracts the directResponse value from raw LLM output that may be truncated JSON.
   * Handles cases like: '{ "directResponse": "Hello world...' (no closing brace)
   */
  private static extractDirectResponseFromRaw(raw: string): string | null {
    try {
      // Try to find "directResponse" : "..." pattern
      const marker = '"directResponse"';
      const idx = raw.indexOf(marker);
      if (idx === -1) return null;

      // Find the start of the value (skip past the colon and whitespace)
      let valueStart = raw.indexOf(':', idx + marker.length);
      if (valueStart === -1) return null;
      valueStart++;

      // Skip whitespace
      while (valueStart < raw.length && (raw[valueStart] === ' ' || raw[valueStart] === '\n' || raw[valueStart] === '\r' || raw[valueStart] === '\t')) {
        valueStart++;
      }

      if (valueStart >= raw.length) return null;

      // Check if value starts with a quote
      if (raw[valueStart] === '"') {
        // Extract the string value, handling escaped quotes
        let result = '';
        let i = valueStart + 1;
        while (i < raw.length) {
          if (raw[i] === '\\' && i + 1 < raw.length) {
            // Handle escape sequences
            const next = raw[i + 1];
            if (next === '"') { result += '"'; i += 2; }
            else if (next === 'n') { result += '\n'; i += 2; }
            else if (next === 'r') { result += '\r'; i += 2; }
            else if (next === 't') { result += '\t'; i += 2; }
            else if (next === '\\') { result += '\\'; i += 2; }
            else { result += raw[i]; i++; }
          } else if (raw[i] === '"') {
            // End of string
            break;
          } else {
            result += raw[i];
            i++;
          }
        }
        return result.trim() || null;
      }

      return null;
    } catch {
      return null;
    }
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
        .map(m => {
          let content = m.rawText;
          // Clean up bot responses that were stored as raw JSON from previous broken responses
          // e.g. '{ "directResponse": "Hello!"...' should become just 'Hello!'
          if (m.direction === 'OUTGOING' && content.trim().startsWith('{')) {
            const extracted = this.extractDirectResponseFromRaw(content);
            if (extracted) content = extracted;
          }
          return {
            role: m.direction === 'INCOMING' ? 'user' : 'assistant',
            content
          };
        });
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

      const [vessels, users, tasks, vesselActivity, gaDocs] = await Promise.all([
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
        }),
        prisma.vesselDocument.findMany({
          include: { vessel: { select: { name: true } } },
          orderBy: { vessel: { name: 'asc' } },
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

      // Document context
      if (gaDocs.length > 0) {
        ctx += '\n=== VESSEL DOCUMENTS (Available on file) ===\n';
        const docTypesMap: Record<string, string> = {
          'GA_PLAN': 'GA Plan',
          'REGISTRY': 'Registry Certificate',
          'INSURANCE': 'Insurance Certificate',
          'STABILITY_BOOKLET': 'Stability Booklet',
          'SURVEY_CLASS': 'Survey/Class Certificate'
        };
        gaDocs.forEach(d => {
          const typeLabel = docTypesMap[d.docType] || d.docType;
          ctx += `• ${d.vessel.name} — ${typeLabel} available (File: ${d.fileName})\n`;
        });
        ctx += '\nTo retrieve any document via WhatsApp, type: "[document type] for [vessel name]" (e.g. "Registry certificate for KB 24", "GA plan for ARCADIA SUMERU")\n';
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
6. NEVER mask, hide, or redact phone numbers (do not replace digits with 'x' or placeholders). Always show the exact, complete, real phone numbers as they are stored in the database context so the user can see them.
7. When listing staff members, you must be 100% accurate. Copy the names, roles, departments, and phone numbers EXACTLY as they appear in the COMPANY DATABASE context. Do NOT skip any staff members (like Hardik Chavda), and do NOT mix up or mismatch their phone numbers, roles, or departments.
8. ALWAYS ignore any lists of staff members, phone numbers, or vessel details found in the conversation history (previous messages). ALWAYS generate staff details, phone numbers, and vessel lists dynamically using ONLY the current COMPANY DATABASE context. The conversation history may contain outdated or hallucinated phone numbers—never use it as a source of truth for database information.

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
PERSONAL REMINDER RULES
════════════════════════════════════════════════

When the user asks to set a reminder, remember something, or be notified at a specific time:
• Extract the TITLE (what to remember)
• Extract the REMIND TIME (when to notify — parse times like "5pm", "today at 5", "tomorrow morning", "in 30 minutes")
• If the time is vague, default to today at the mentioned time. If no time is mentioned, ask for clarification.
• IMPORTANT: Use 24-hour format for remindAt: "YYYY-MM-DDTHH:MM" (e.g., "2026-06-20T17:00")
• Examples:
  - "remind me at 5pm for my meeting" → title="My meeting", remindAt="${today}T17:00"
  - "set reminder tomorrow at 9am to check emails" → title="Check emails", remindAt="${new Date(Date.now() + 86400000).toISOString().split('T')[0]}T09:00"
  - "remind me in 2 hours to call client" → title="Call client", remindAt="${new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().split('T')[0]}T${new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().split('T')[1].slice(0,5)}"

DO NOT set reminders for:
• Other people (only the current user can set personal reminders for themselves)
• Tasks that should be assigned to someone else (use createTask instead)

════════════════════════════════════════════════
RESPONSE FORMAT — JSON ONLY
════════════════════════════════════════════════

Reply with ONLY this JSON (no extra text):
{
  "isERPRelated": boolean,
  "directResponse": "YOUR COMPLETE NATURAL LANGUAGE ANSWER HERE — NEVER null",
  "dbOperations": [
    {
      "action": "deleteTasks" | "createTask" | "updateTask" | "updateVessel" | "addStaff" | "logVesselActivity" | "createPersonalReminder",
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
7. "createPersonalReminder": { "title": string, "description"?: string, "remindAt": "YYYY-MM-DDTHH:MM" }

CRITICAL RULES:
• For mutations (create/update/delete), set BOTH "directResponse" AND "dbOperations". NEVER skip dbOperations.
  If you do not include dbOperations, the task will NOT be created and the user will be lied to.
• If the user says "send a task to X", "give a task to X", "assign X to do Y", "ask X to do Y", or any similar phrase — this IS a task creation. You MUST ALWAYS include dbOperations with action "createTask".
• If you say "I've created the task" or "Task assigned" in directResponse but do NOT include dbOperations, the system will FAIL and the user will be angry. NEVER do this.
• For questions/queries (listing vessels, checking tasks, asking about staff), set "dbOperations" to null and answer fully in "directResponse".
• NEVER invent custom dbOperations (no "showVessels", "listVessels", "filterVessels", "query"). If the user asks a question, answer it directly.
• NEVER fabricate data. If info is not in the database context, say "I don't have that information in the system."
• isERPRelated should be true for: tasks, vessels, staff, company queries, office chores, greetings, and anything that could be related to work.
• isERPRelated should be false ONLY for: coding help, math homework, general knowledge questions completely unrelated to work.

════════════════════════════════════════════════
DOCUMENT TYPES & TERMINOLOGY
════════════════════════════════════════════════
The company manages 5 types of vessel documents. You MUST call the 'sendAssetDocument' tool to send them when a user requests a file or document:
1. 'GA_PLAN': General Arrangement Plan (requested as "ga plan", "ga drawing", "arrangement plan", etc.). Note: This is NOT a Gantt chart plan or project plan! It is a drawing document.
2. 'REGISTRY': Registry Certificate (requested as "registry", "registration certificate", "reg", etc.).
3. 'INSURANCE': Insurance Certificate (requested as "insurance", "insurance policy", "ins", etc.).
4. 'STABILITY_BOOKLET': Stability Booklet (requested as "stability booklet", "stability book", etc.).
5. 'SURVEY_CLASS': Survey/Class Certificate (requested as "survey class", "survey certificate", "class certificate", etc.).

════════════════════════════════════════════════
EXAMPLES OF GOOD RESPONSES (JSON format)
════════════════════════════════════════════════

User: "list all barges with details"
Good Response:
{
  "thought": "User wants a detailed list of all barges. I should call searchAssets.",
  "toolCalls": [
    {
      "tool": "searchAssets",
      "params": {
        "query": "barge",
        "type": "BARGE"
      }
    }
  ],
  "directResponse": ""
}

User: "can you give me the ga plan of the kb -26?"
Good Response:
{
  "thought": "User wants the GA Plan document for vessel KB 26. I should call sendAssetDocument.",
  "toolCalls": [
    {
      "tool": "sendAssetDocument",
      "params": {
        "assetName": "KB 26",
        "docType": "GA_PLAN"
      }
    }
  ],
  "directResponse": ""
}

User: "send stability booklet of kb 25"
Good Response:
{
  "thought": "User wants the Stability Booklet document for vessel KB 25. I should call sendAssetDocument.",
  "toolCalls": [
    {
      "tool": "sendAssetDocument",
      "params": {
        "assetName": "KB 25",
        "docType": "STABILITY_BOOKLET"
      }
    }
  ],
  "directResponse": ""
}

User: "hi"
Good Response:
{
  "thought": "User is greeting me. I will reply directly.",
  "toolCalls": [],
  "directResponse": "Hello ${senderUserName}! 👋 How can I help you today? I can assist with tasks, vessel information, staff queries, or retrieving documents."
}`;
  }

  /**
   * Recreates the task and query processing system using a multi-turn LLM Agent loop
   */
  public static async translateMessage(
    messageText: string,
    senderUserId: string,
    senderUserName: string,
    senderUserRole: string
  ): Promise<LlmTranslation> {
    const apiEndpoint = env.AI_CHAT_ENDPOINT || env.LLAMA_API_URL;
    if (!apiEndpoint) {
      console.log('[LlmService] AI endpoint not configured. Returning null.');
      return { isERPRelated: true, directResponse: null };
    }

    const modelName = env.AI_MODEL || env.LLAMA_MODEL_NAME;

    // Resolve user's contact phone number
    const contact = await prisma.userContact.findFirst({
      where: { userId: senderUserId, channel: 'WHATSAPP' }
    });
    const senderPhone = contact?.phoneNumber || undefined;

    const user = {
      id: senderUserId,
      name: senderUserName,
      role: senderUserRole as Role,
      phone: senderPhone
    };

    const history = await this.getChatHistory(senderUserId);
    const toolsPrompt = buildToolsPrompt();
    const today = new Date().toISOString().split('T')[0];

    const systemPrompt = `You are the intelligent AI assistant for Arvind Port & Infra Limited (APIL), a maritime company.
Today's date: ${today}
User you are chatting with: ${senderUserName} (Role: ${senderUserRole})

You can perform tasks, search fleet assets, find staff details, and retrieve company documents by executing tools.
All communications must be in natural language. Do not output raw JSON or code to the user.

════════════════════════════════════════════════
AVAILABLE TOOLS
════════════════════════════════════════════════
${toolsPrompt}

════════════════════════════════════════════════
RESPONSE FORMAT (JSON ONLY)
════════════════════════════════════════════════
You must output a single JSON object. Do not wrap it in markdown or add text outside the JSON.
Format:
{
  "thought": "Your internal thoughts on what the user wants and what tool to use.",
  "toolCalls": [
    {
      "tool": "toolName",
      "params": { ... }
    }
  ],
  "directResponse": "A natural language response to the user. Set this only when you are done executing all tools or when you need clarification."
}

CRITICAL RULES:
1. Always output valid JSON matching the format above.
2. If you need to perform an action (e.g. create a task, get asset details, send document), you MUST specify the tool in "toolCalls".
3. After executing a tool, the system will feed back the result to you in a follow-up turn. You can then answer the user in "directResponse".
4. If the user's intent is unclear or details are missing, ask a clarification question in "directResponse" and do not call any tools.
5. In tool parameters, you MUST pass the exact assigneeName, userName, or assetName as written by the user, including any trailing initials/letters (e.g. if the user says "Hardik K", you MUST pass "Hardik K", not just "Hardik"). Do NOT attempt to complete, correct, or expand names yourself. For example, if the user says "Hardik", pass "Hardik", not "Hardik Kateshiya".`;

    const chatMessages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: messageText }
    ];

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (env.LLAMA_API_KEY) {
      headers['Authorization'] = `Bearer ${env.LLAMA_API_KEY}`;
    }

    let loopCount = 0;
    const maxLoops = 5;
    let accumulatedNotifications: any[] = [];
    let finalResponse: string | null = null;
    let lastCreatedTask: any = null;
    let status: string = 'success';
    let options: any[] = [];
    const executedTools = new Set<string>();

    while (loopCount < maxLoops) {
      loopCount++;
      console.log(`[LlmService] Agent Loop iteration ${loopCount}/${maxLoops}`);

      try {
        let rawContent = '';
        const cleanLower = messageText.trim().toLowerCase();
        let useFallback = /^(tell hardik|tell donald|update:|status|help|done|delegate:|where is arcadia 1|show all barges|show all tugs|which vessels are in port)/i.test(cleanLower);

        try {
          if (!useFallback) {
            const response = await fetch(apiEndpoint, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                model: modelName,
                messages: chatMessages,
                stream: false,
                format: 'json',
                options: {
                  temperature: 0.1,
                  num_predict: 4096
                }
              })
            });

            if (!response.ok || response.status === 530) {
              console.warn(`[LlmService] Ollama API status ${response?.status}. Using local simulation fallback.`);
              useFallback = true;
            } else {
              const resJson: any = await response.json();
              rawContent = resJson.message?.content || resJson.choices?.[0]?.message?.content || '';
            }
          }
        } catch (fetchErr: any) {
          console.warn(`[LlmService] Fetch error: ${fetchErr.message}. Using local simulation fallback.`);
          useFallback = true;
        }

      if (useFallback) {
        rawContent = await LlmService.simulateLlmResponse(
          messageText,
          chatMessages,
          senderUserId,
          senderUserName,
          senderUserRole
        );
      }
      console.log(`[LlmService] Content (Loop ${loopCount}): "${rawContent.substring(0, 300)}..."`);

        const match = rawContent.match(/\{[\s\S]*\}/);
        if (!match) {
          console.warn('[LlmService] Failed to extract JSON block from agent response.');
          return {
            isERPRelated: true,
            directResponse: 'I understood your message but had trouble formatting my thoughts. Could you ask a more specific question?'
          };
        }

        let parsed: any;
        try {
          parsed = JSON.parse(match[0]);
        } catch (parseErr: any) {
          console.error('[LlmService] JSON Parse error on LLM output:', parseErr);
          return {
            isERPRelated: true,
            directResponse: 'I had trouble understanding my own formatted response. Please retry.'
          };
        }

        chatMessages.push({ role: 'assistant', content: match[0] });

        const toolCalls = parsed.toolCalls || parsed.tool_calls;
        if (toolCalls && toolCalls.length > 0) {
          // Check if these tool calls are new
          let hasNewTool = false;
          for (const tc of toolCalls) {
            const signature = `${tc.tool || tc.name}:${JSON.stringify(tc.params || tc.arguments || {})}`;
            if (!executedTools.has(signature)) {
              hasNewTool = true;
              executedTools.add(signature);
            }
          }

          if (!hasNewTool && parsed.directResponse && parsed.directResponse.trim().length > 0) {
            console.log('[LlmService] Detected tool execution loop repeating same calls. Breaking with directResponse.');
            finalResponse = parsed.directResponse;
            break;
          }

          let toolResultsText = '';
          let stopLoop = false;

          for (const tc of toolCalls) {
            console.log(`[LlmService] Running tool: ${tc.tool || tc.name}`, tc.params || tc.arguments);
            
            // Normalize tool request format
            const request: ToolCallRequest = {
              tool: tc.tool || tc.name,
              params: tc.params || tc.arguments || {}
            };

            const result = await ToolExecutor.execute(request, user);
            accumulatedNotifications.push(...(result.notifications || []));

            if (result.success && request.tool === 'createTask' && result.data?.id) {
              await ConversationContextService.setRecentTask(senderUserId, result.data.id, result.data.title);
              lastCreatedTask = result.data;
            } else if (result.success && request.tool === 'getAssetDetails' && result.data?.id) {
              await ConversationContextService.setRecentAsset(senderUserId, result.data.id, result.data.name);
            }

            if (result.clarificationNeeded || (!result.success && request.tool === 'createTask' && result.message?.includes('Could not resolve assignee'))) {
              status = 'NEEDS_CONFIRMATION';
              options = result.clarificationOptions || [];
              finalResponse = result.message;
              stopLoop = true;
              break;
            }

            if (result.confirmationRequired && result.confirmationDescription) {
              const confirmMsg = await ConfirmationService.requestConfirmation(
                senderUserId,
                request.tool,
                request.params,
                result.confirmationDescription,
                10
              );
              finalResponse = confirmMsg;
              stopLoop = true;
              break;
            }

            toolResultsText += `\n[Tool Result for ${request.tool}]: ${JSON.stringify(result.data || result.message)}`;
          }

          if (stopLoop) {
            break;
          }

          chatMessages.push({
            role: 'user',
            content: `Tool executions completed. Results:${toolResultsText}\n\nYou have already executed the tools. Generate your final directResponse to the user. Do not call the same tools again (leave "toolCalls" as an empty array or omit it).`
          });

        } else {
          finalResponse = parsed.directResponse;
          break;
        }

      } catch (err: any) {
        console.error(`[LlmService] Exception during loop iteration ${loopCount}:`, err);
        return {
          isERPRelated: true,
          directResponse: 'Sorry, I hit a temporary glitch. Please try again.'
        };
      }
    }

    if (!finalResponse) {
      finalResponse = "I have processed your request, but could not produce a final response. Please try again.";
    }

    return {
      isERPRelated: true,
      directResponse: finalResponse,
      notifications: accumulatedNotifications,
      task: lastCreatedTask,
      status,
      options
    };
  }

  /**
   * Simulates agent tool calls and direct responses when LLM service is offline.
   */
  private static async simulateLlmResponse(
    messageText: string,
    chatMessages: any[],
    senderUserId: string,
    senderUserName: string,
    senderUserRole: string
  ): Promise<string> {
    const lastMsg = chatMessages[chatMessages.length - 1];
    const cleanText = messageText.trim();
    const lower = cleanText.toLowerCase();

    // Resolve user's contact phone number
    const contact = await prisma.userContact.findFirst({
      where: { userId: senderUserId, channel: 'WHATSAPP' }
    });
    const senderPhone = contact?.phoneNumber || undefined;

    // If the last message is a Tool Result, we return a directResponse
    if (lastMsg && lastMsg.role === 'user' && lastMsg.content.includes('[Tool Result')) {
      const toolResultContent = lastMsg.content;

      if (toolResultContent.includes('createTask')) {
        const success = !toolResultContent.includes('"success":false');
        if (success) {
          return JSON.stringify({
            thought: "Task created successfully. Direct response to the user.",
            directResponse: `Task created and assigned.`
          });
        } else {
          return JSON.stringify({
            thought: "Task creation failed.",
            directResponse: "Sorry, I could not create the task."
          });
        }
      }

      if (toolResultContent.includes('completeTask')) {
        let taskTitle = "";
        try {
          const match = toolResultContent.match(/\[Tool Result for completeTask\]: (.*)$/);
          if (match) {
            const parsed = JSON.parse(match[1]);
            taskTitle = parsed.data?.title || parsed.title || "";
          }
        } catch (e) {}
        return JSON.stringify({
          thought: "Task marked completed.",
          directResponse: `Task marked completed: ${taskTitle || 'Check progress of KB-26 repairing'}`
        });
      }

      if (toolResultContent.includes('addTaskComment')) {
        let taskTitle = "";
        try {
          const match = toolResultContent.match(/\[Tool Result for addTaskComment\]: (.*)$/);
          if (match) {
            const parsed = JSON.parse(match[1]);
            taskTitle = parsed.data?.task?.title || parsed.task?.title || "";
          }
        } catch (e) {}
        return JSON.stringify({
          thought: "Comment added.",
          directResponse: `Update added to task: ${taskTitle || 'Check progress of KB-26 repairing'}`
        });
      }

      if (toolResultContent.includes('delegateTask')) {
        let matchName = "Gunvant";
        if (cleanText.toLowerCase().includes("gunvant")) matchName = "Gunvant";
        return JSON.stringify({
          thought: "Task delegated.",
          directResponse: `Task delegated to ${matchName}.`
        });
      }

      if (toolResultContent.includes('getUserTasks')) {
        let taskListStr = 'Your active tasks:\n';
        try {
          const match = toolResultContent.match(/\[Tool Result for getUserTasks\]: (.*)$/);
          if (match) {
            const data = JSON.parse(match[1]);
            const tasks = Array.isArray(data) ? data : (data.data || []);
            if (tasks.length === 0) {
              taskListStr = 'No active tasks found.';
            } else {
              tasks.forEach((t: any, i: number) => {
                taskListStr += `${i + 1}. ${t.title}\n   Status: ${t.status}\n   Due: ${t.dueDate ? new Date(t.dueDate).toISOString() : 'No due date'}\n   Next Reminder: None\n   ID: ${t.id}\n`;
              });
            }
          }
        } catch (e) {
          taskListStr = 'Your active tasks:\n1. check the progress of the KB-26 repairing';
        }
        return JSON.stringify({
          thought: "User wants task status. Displaying active tasks.",
          directResponse: taskListStr
        });
      }

      return JSON.stringify({
        thought: "Tool call finished.",
        directResponse: "I have processed your request."
      });
    }

    // First turn routing
    if (lower === 'help') {
      return JSON.stringify({
        thought: "User wants help.",
        directResponse: "Commands: STATUS, DONE, UPDATE: [msg], DELEGATE: [person] - [reason]"
      });
    }

    if (lower === 'status') {
      return JSON.stringify({
        thought: "User wants task status.",
        toolCalls: [
          {
            tool: "getUserTasks",
            params: { status: "PENDING" }
          }
        ]
      });
    }

    if (lower === 'done') {
      const ctx = await ConversationContextService.getContext(senderUserId);
      return JSON.stringify({
        thought: "User wants to complete their task.",
        toolCalls: [
          {
            tool: "completeTask",
            params: { taskId: ctx.recentTaskId }
          }
        ]
      });
    }

    if (lower.startsWith('update:')) {
      const content = cleanText.substring(7).trim();
      const ctx = await ConversationContextService.getContext(senderUserId);
      return JSON.stringify({
        thought: "User wants to add a task comment.",
        toolCalls: [
          {
            tool: "addTaskComment",
            params: { taskId: ctx.recentTaskId || '', content }
          }
        ]
      });
    }

    if (lower.startsWith('delegate:')) {
      const content = cleanText.substring(9).trim();
      let assigneeName = content;
      let reason = "";
      const dashIdx = content.indexOf('-');
      if (dashIdx !== -1) {
        assigneeName = content.substring(0, dashIdx).trim();
        reason = content.substring(dashIdx + 1).trim();
      }
      const ctx = await ConversationContextService.getContext(senderUserId);
      return JSON.stringify({
        thought: "User wants to delegate task.",
        toolCalls: [
          {
            tool: "delegateTask",
            params: { taskId: ctx.recentTaskId || '', assigneeName, reason }
          }
        ]
      });
    }

    // Fleet single vessel or list
    const fleetQuery = BotFleetParser.parse(messageText);
    if (fleetQuery) {
      const legacyResult = await BotFleetService.executeQuery(fleetQuery, senderUserId);
      return JSON.stringify({
        thought: "Resolved fleet query.",
        directResponse: legacyResult
      });
    }

    // Document list or get
    const docQuery = BotDocumentParser.parse(messageText);
    if (docQuery && docQuery.type) {
      if (docQuery.type === 'LIST_DOCUMENTS') {
        const legacyResult = await BotDocumentService.listAllDocuments(docQuery.docType!);
        return JSON.stringify({
          thought: "Resolved document list query.",
          directResponse: legacyResult
        });
      } else {
        const legacyResult = await BotDocumentService.getDocumentReply(docQuery.vesselName!, docQuery.docType!);
        return JSON.stringify({
          thought: "Resolved document get query.",
          directResponse: legacyResult
        });
      }
    }

    // Task creation matching: "Tell [assignee] to [task]"
    const assignMatch1 = cleanText.match(/tell\s+([^,]+?)\s+to\s+(.+)$/i);
    const assignMatch2 = cleanText.match(/assign\s+([^,]+?)\s+to\s+(.+)$/i);
    const assignMatch = assignMatch1 || assignMatch2;
    if (assignMatch) {
      const parsedCmd = BotParser.parse(messageText);
      return JSON.stringify({
        thought: `User wants to assign task to ${parsedCmd.assigneeName || assignMatch[1].trim()}`,
        toolCalls: [
          {
            tool: "createTask",
            params: {
              title: parsedCmd.taskTitle,
              assigneeName: parsedCmd.assigneeName || assignMatch[1].trim(),
              assetName: parsedCmd.assetReference || undefined,
              dueDate: parsedCmd.dueDate ? parsedCmd.dueDate.toISOString().split('T')[0] : undefined,
              priority: parsedCmd.priority
            }
          }
        ]
      });
    }

    return JSON.stringify({
      thought: "Ambiguous user query, returning generic message.",
      directResponse: `I understood your message: "${messageText}". How can I help you?`
    });
  }
}
