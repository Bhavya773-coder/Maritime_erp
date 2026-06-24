import prisma from '../../config/db';
import { Role, BotChannel } from '@prisma/client';
import { getToolDefinition } from './tool-definitions';
import { BotService } from './bot.service';
import { calculateNextReminderAt, getVesselNameCandidates } from './bot.utils';
import { CertsService } from '../certifications/certs.service';
import { TasksService } from '../tasks/tasks.service';

export interface ToolCallRequest {
  tool: string;
  params: Record<string, any>;
}

export interface ToolCallResult {
  success: boolean;
  tool: string;
  data: any;
  message: string;
  notifications: Array<{
    toUserId: string | null;
    toPhone: string;
    messageType: 'TEXT' | 'INTERACTIVE_BUTTON' | 'DOCUMENT' | 'TEMPLATE';
    text: string;
    rawText?: string;
    taskId?: string;
  }>;
  auditLog: {
    action: string;
    details: string;
  };
  clarificationNeeded?: boolean;
  clarificationOptions?: any[];
  confirmationRequired?: boolean;
  confirmationDescription?: string;
  confirmationParams?: Record<string, any>;
}

export class ToolExecutor {
  /**
   * Execute a single tool call with full validation, permission checks, and audit logging.
   */
  public static async execute(
    request: ToolCallRequest,
    user: { id: string; name: string; role: Role; phone?: string }
  ): Promise<ToolCallResult> {
    const def = getToolDefinition(request.tool);
    if (!def) {
      return {
        success: false,
        tool: request.tool,
        data: null,
        message: `Unknown tool: ${request.tool}`,
        notifications: [],
        auditLog: { action: 'TOOL_UNKNOWN', details: `Unknown tool: ${request.tool}` },
      };
    }

    // 1. Permission check
    if (!def.permissionCheck(user.role)) {
      return {
        success: false,
        tool: request.tool,
        data: null,
        message: `You do not have permission to perform this action. Required role: MANAGEMENT or higher.`,
        notifications: [],
        auditLog: { action: 'TOOL_PERMISSION_DENIED', details: `User ${user.name} (${user.role}) denied access to ${request.tool}` },
      };
    }

    // 2. Validate parameters with Zod
    const parseResult = def.paramsSchema.safeParse(request.params);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      return {
        success: false,
        tool: request.tool,
        data: null,
        message: `Invalid parameters: ${errors}`,
        notifications: [],
        auditLog: { action: 'TOOL_VALIDATION_FAILED', details: `Tool ${request.tool} validation failed: ${errors}` },
      };
    }
    const params = parseResult.data;

    // 3. Confirmation gate for risky actions
    if (def.requiresConfirmation) {
      return {
        success: false,
        tool: request.tool,
        data: null,
        message: `This action requires confirmation. Please reply "CONFIRM" to proceed or "CANCEL" to abort.`,
        notifications: [],
        auditLog: { action: 'TOOL_CONFIRMATION_REQUIRED', details: `Tool ${request.tool} requires confirmation` },
        confirmationRequired: true,
        confirmationDescription: `Execute ${request.tool}: ${JSON.stringify(params)}`,
        confirmationParams: params,
      };
    }

    // 4. Execute the tool
    try {
      const result = await this.executeToolInternal(request.tool, params, user);
      if (result.notifications && result.notifications.length > 0) {
        result.notifications = result.notifications.map((n: any) => ({
          ...n,
          rawText: n.rawText || n.text
        }));
      }
      return result;
    } catch (err: any) {
      console.error(`[ToolExecutor] Error executing ${request.tool}:`, err);
      return {
        success: false,
        tool: request.tool,
        data: null,
        message: `Error executing ${request.tool}: ${err.message}`,
        notifications: [],
        auditLog: { action: 'TOOL_EXECUTION_ERROR', details: `Tool ${request.tool} failed: ${err.message}` },
      };
    }
  }

  private static async executeToolInternal(
    tool: string,
    params: Record<string, any>,
    user: { id: string; name: string; role: Role; phone?: string }
  ): Promise<ToolCallResult> {
    const notifications: ToolCallResult['notifications'] = [];

    switch (tool) {
      case 'searchUsers': {
        const users = await BotService.resolveAssignee(params.query);
        const limited = users.slice(0, params.limit || 10);
        return {
          success: true,
          tool,
          data: limited,
          message: limited.length > 0
            ? `Found ${limited.length} user(s):\n${limited.map((u: any) => `• ${u.name} (${u.role}${u.department ? ', ' + u.department : ''})`).join('\n')}`
            : `No users found matching "${params.query}".`,
          notifications,
          auditLog: { action: 'TOOL_SEARCH_USERS', details: `Searched users: "${params.query}" — found ${limited.length}` },
        };
      }

      case 'searchAssets': {
        const where: any = { deletedAt: null };
        if (params.type) where.type = params.type;
        if (params.status) where.status = params.status;
        if (params.query) {
          where.name = { contains: params.query, mode: 'insensitive' };
        }
        const vessels = await prisma.vessel.findMany({
          where,
          select: { id: true, name: true, type: true, status: true, currentLocation: true },
          orderBy: { name: 'asc' },
          take: 20,
        });
        return {
          success: true,
          tool,
          data: vessels,
          message: vessels.length > 0
            ? `Found ${vessels.length} vessel(s):\n${vessels.map((v: any) => `• ${v.name} (${v.type}, ${v.status}, ${v.currentLocation})`).join('\n')}`
            : `No vessels found matching "${params.query}".`,
          notifications,
          auditLog: { action: 'TOOL_SEARCH_ASSETS', details: `Searched vessels: "${params.query}" — found ${vessels.length}` },
        };
      }

      case 'getAssetDetails': {
        const candidates = getVesselNameCandidates(params.assetName);
        let vessel = null;
        for (const c of candidates) {
          vessel = await prisma.vessel.findFirst({
            where: { name: { contains: c, mode: 'insensitive' }, deletedAt: null },
            include: {
              certifications: true,
              documents: { select: { docType: true, fileName: true } },
            },
          });
          if (vessel) break;
        }
        if (!vessel) {
          return {
            success: false, tool, data: null, message: `Vessel "${params.assetName}" not found.`, notifications,
            auditLog: { action: 'TOOL_GET_ASSET_DETAILS', details: `Vessel "${params.assetName}" not found` },
          };
        }
        const certs = vessel.certifications.map((c: any) =>
          `${c.certType}: ${c.certNumber} — expires ${c.expiryDate.toISOString().split('T')[0]} (${c.status})`
        ).join('\n') || 'No certificates on file.';
        const docs = vessel.documents.map((d: any) => `${d.docType}: ${d.fileName}`).join('\n') || 'No documents on file.';
        return {
          success: true,
          tool,
          data: vessel,
          message: `*${vessel.name}* (${vessel.type})\nStatus: ${vessel.status}\nLocation: ${vessel.currentLocation}\nRegistration: ${vessel.registrationNo}\nClassification: ${vessel.classification || 'N/A'}\n\n📋 Certificates:\n${certs}\n\n📄 Documents:\n${docs}`,
          notifications,
          auditLog: { action: 'TOOL_GET_ASSET_DETAILS', details: `Retrieved details for ${vessel.name}` },
        };
      }

      case 'getAssetDocuments': {
        const candidates = getVesselNameCandidates(params.assetName);
        let vessel = null;
        for (const c of candidates) {
          vessel = await prisma.vessel.findFirst({
            where: { name: { contains: c, mode: 'insensitive' }, deletedAt: null },
            include: { documents: true },
          });
          if (vessel) break;
        }
        if (!vessel) {
          return {
            success: false, tool, data: null, message: `Vessel "${params.assetName}" not found.`, notifications,
            auditLog: { action: 'TOOL_GET_ASSET_DOCUMENTS', details: `Vessel "${params.assetName}" not found` },
          };
        }
        let docs = vessel.documents;
        if (params.docType) docs = docs.filter((d: any) => d.docType === params.docType);
        return {
          success: true,
          tool,
          data: docs,
          message: docs.length > 0
            ? `Documents for ${vessel.name}:\n${docs.map((d: any) => `• ${d.docType}: ${d.fileName}`).join('\n')}`
            : `No documents found for ${vessel.name}.`,
          notifications,
          auditLog: { action: 'TOOL_GET_ASSET_DOCUMENTS', details: `Listed ${docs.length} documents for ${vessel.name}` },
        };
      }

      case 'createTask': {
        const candidates = await BotService.resolveAssignee(params.assigneeName);
        if (candidates.length === 0) {
          return {
            success: false, tool, data: null, message: `Could not resolve assignee "${params.assigneeName}". No active user matched.`, notifications,
            auditLog: { action: 'TOOL_CREATE_TASK', details: `Failed: no assignee found for "${params.assigneeName}"` },
          };
        }
        if (candidates.length > 1) {
          return {
            success: false, tool, data: null,
            message: `Multiple matches found for "${params.assigneeName}". Which one do you mean?\n${candidates.map((c: any, i: number) => `${i + 1}. ${c.name} (${c.department || 'No dept'})`).join('\n')}\n\nReply with the number or full name.`,
            notifications, clarificationNeeded: true, clarificationOptions: candidates,
            auditLog: { action: 'TOOL_CREATE_TASK_CLARIFICATION', details: `Ambiguous assignee: ${params.assigneeName}` },
          };
        }
        const assignee = candidates[0];
        let dueDate: Date | null = null;
        if (params.dueDate) {
          dueDate = new Date(params.dueDate);
        } else {
          dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        }
        const task = await prisma.task.create({
          data: {
            title: params.title,
            description: params.description || `Created via AI assistant for ${assignee.name}`,
            taskType: 'ASSIGNED',
            createdById: user.id,
            assignedToId: assignee.id,
            dueDate,
            priority: params.priority || 'MEDIUM',
            status: 'PENDING',
          },
          include: { assignee: { select: { name: true } }, creator: { select: { name: true } } },
        });
        await prisma.taskDelegationLog.create({
          data: { taskId: task.id, fromUserId: user.id, toUserId: assignee.id, note: 'Initial assignment via AI' },
        });
        await prisma.botReminder.create({
          data: {
            taskId: task.id,
            assignedToId: assignee.id,
            reminderType: 'TASK_PENDING',
            frequencyHours: 24,
            nextReminderAt: calculateNextReminderAt(dueDate),
            status: 'ACTIVE',
          },
        });
        const assigneeContact = await prisma.userContact.findFirst({
          where: { userId: assignee.id, channel: 'WHATSAPP' },
        });
        if (assigneeContact) {
          notifications.push({
            toUserId: assignee.id,
            toPhone: assigneeContact.phoneNumber,
            messageType: 'INTERACTIVE_BUTTON',
            text: `New task from ${user.name}: ${task.title}. Due: ${dueDate.toISOString().split('T')[0]}. Reply DONE, UPDATE, or DELEGATE.`,
            rawText: `New task from ${user.name}: ${task.title}. Due: ${dueDate.toISOString().split('T')[0]}. Reply DONE, UPDATE, or DELEGATE.`,
            taskId: task.id,
          });
        }
        const senderContact = await prisma.userContact.findFirst({
          where: { userId: user.id, channel: 'WHATSAPP' },
        });
        if (senderContact) {
          notifications.push({
            toUserId: user.id,
            toPhone: senderContact.phoneNumber,
            messageType: 'TEXT',
            text: `Task created: "${task.title}" has been assigned to ${assignee.name}.`,
            rawText: `Task created: "${task.title}" has been assigned to ${assignee.name}.`,
            taskId: task.id,
          });
        }
        return {
          success: true, tool, data: task,
          message: `✅ Task created: "${task.title}" assigned to ${assignee.name}. Due: ${dueDate.toISOString().split('T')[0]}.`,
          notifications,
          auditLog: { action: 'TOOL_CREATE_TASK', details: `Task "${task.title}" (ID: ${task.id}) assigned to ${assignee.name}` },
        };
      }

      case 'getUserTasks': {
        let targetUserId = user.id;
        if (params.userName) {
          const candidates = await BotService.resolveAssignee(params.userName);
          if (candidates.length === 1) targetUserId = candidates[0].id;
          else if (candidates.length > 1) {
            return {
              success: false, tool, data: null,
              message: `Multiple users found for "${params.userName}". Please specify the exact name.`,
              notifications, clarificationNeeded: true, clarificationOptions: candidates,
              auditLog: { action: 'TOOL_GET_USER_TASKS', details: `Ambiguous user: ${params.userName}` },
            };
          }
        }
        const where: any = { isDeleted: false, deletedAt: null };
        if (user.role !== 'OWNER') {
          if (user.role === 'MANAGER' || user.role === 'FLEET_MANAGER') {
            where.OR = [{ createdById: user.id }, { assignedToId: user.id }];
          } else if (targetUserId !== user.id) {
            return {
              success: false, tool, data: null, message: `You can only view your own tasks.`, notifications,
              auditLog: { action: 'TOOL_GET_USER_TASKS', details: `Access denied: ${user.name} tried to view tasks of ${targetUserId}` },
            };
          } else {
            where.OR = [{ createdById: user.id }, { assignedToId: user.id }];
          }
        }
        if (params.status) where.status = params.status;
        if (params.overdue) where.status = 'OVERDUE';
        const tasks = await prisma.task.findMany({
          where, include: { assignee: { select: { name: true } }, creator: { select: { name: true } } },
          orderBy: { createdAt: 'desc' }, take: 20,
        });
        return {
          success: true, tool, data: tasks,
          message: tasks.length > 0
            ? `Tasks (${tasks.length}):\n${tasks.map((t: any, i: number) => `${i + 1}. "${t.title}" — ${t.status} | Due: ${t.dueDate ? t.dueDate.toISOString().split('T')[0] : 'No date'} | Assigned: ${t.assignee?.name || 'Unassigned'}`).join('\n')}`
            : `No tasks found.`,
          notifications,
          auditLog: { action: 'TOOL_GET_USER_TASKS', details: `Retrieved ${tasks.length} tasks` },
        };
      }

      case 'completeTask': {
        let task: any = null;
        if (params.taskId) {
          task = await prisma.task.findUnique({ where: { id: params.taskId } });
        } else if (params.titleContains) {
          const tasks = await prisma.task.findMany({
            where: { title: { contains: params.titleContains, mode: 'insensitive' }, isDeleted: false, status: { not: 'COMPLETED' } },
            orderBy: { createdAt: 'desc' },
          });
          if (tasks.length === 1) task = tasks[0];
          else if (tasks.length > 1) {
            return {
              success: false, tool, data: null,
              message: `Multiple tasks match "${params.titleContains}". Which one?\n${tasks.slice(0, 5).map((t: any, i: number) => `${i + 1}. ${t.title} (ID: ${t.id})`).join('\n')}`,
              notifications, clarificationNeeded: true, clarificationOptions: tasks.slice(0, 5),
              auditLog: { action: 'TOOL_COMPLETE_TASK', details: `Ambiguous task: ${params.titleContains}` },
            };
          }
        }
        if (!task) {
          const activeTasks = await prisma.task.findMany({
            where: { assignedToId: user.id, isDeleted: false, status: { not: 'COMPLETED' } },
            orderBy: { createdAt: 'desc' }, take: 1,
          });
          if (activeTasks.length === 1) task = activeTasks[0];
        }
        if (!task) {
          return {
            success: false, tool, data: null, message: `No active task found to complete.`, notifications,
            auditLog: { action: 'TOOL_COMPLETE_TASK', details: `No task found for user ${user.name}` },
          };
        }
        // Permission: assignee, creator, or management
        const isAssignee = task.assignedToId === user.id;
        const isCreator = task.createdById === user.id;
        const isManagement = user.role === 'OWNER' || user.role === 'MANAGER' || user.role === 'FLEET_MANAGER';
        if (!isAssignee && !isCreator && !isManagement) {
          return {
            success: false, tool, data: null, message: `You do not have permission to complete this task.`, notifications,
            auditLog: { action: 'TOOL_COMPLETE_TASK', details: `Permission denied for task ${task.id}` },
          };
        }
        const updated = await prisma.task.update({
          where: { id: task.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
          include: { creator: { select: { name: true } }, assignee: { select: { name: true } } },
        });
        await prisma.botReminder.updateMany({
          where: { taskId: task.id, status: 'ACTIVE' },
          data: { status: 'COMPLETED' },
        });
        if (params.notes) {
          await prisma.taskComment.create({ data: { taskId: task.id, userId: user.id, content: params.notes } });
        }
        const creatorContact = await prisma.userContact.findFirst({
          where: { userId: updated.createdById, channel: 'WHATSAPP' },
        });
        if (creatorContact && updated.createdById !== user.id) {
          notifications.push({
            toUserId: updated.createdById, toPhone: creatorContact.phoneNumber,
            messageType: 'TEXT', text: `${user.name} completed task: "${updated.title}".${params.notes ? `\nNote: ${params.notes}` : ''}`,
          });
        }
        return {
          success: true, tool, data: updated,
          message: `✅ Task completed: "${updated.title}".${params.notes ? `\nNote: ${params.notes}` : ''}`,
          notifications,
          auditLog: { action: 'TOOL_COMPLETE_TASK', details: `Task "${updated.title}" (ID: ${updated.id}) completed by ${user.name}` },
        };
      }

      case 'requestTaskDelay': {
        let task: any = null;
        if (params.taskId) task = await prisma.task.findUnique({ where: { id: params.taskId } });
        else if (params.titleContains) {
          const tasks = await prisma.task.findMany({
            where: { title: { contains: params.titleContains, mode: 'insensitive' }, isDeleted: false, status: { not: 'COMPLETED' } },
            orderBy: { createdAt: 'desc' }, take: 1,
          });
          if (tasks.length > 0) task = tasks[0];
        }
        if (!task) {
          return { success: false, tool, data: null, message: `No task found to delay.`, notifications, auditLog: { action: 'TOOL_REQUEST_DELAY', details: 'No task found' } };
        }
        const isAssignee = task.assignedToId === user.id;
        const isCreator = task.createdById === user.id;
        if (!isAssignee && !isCreator) {
          return { success: false, tool, data: null, message: `Only the assignee or creator can request a delay.`, notifications, auditLog: { action: 'TOOL_REQUEST_DELAY', details: `Permission denied for task ${task.id}` } };
        }
        const proposedDueDate = new Date(params.proposedDueDate);
        const delayRequest = await prisma.delayRequest.create({
          data: { taskId: task.id, requestedById: user.id, proposedDueDate, reason: params.reason, status: 'PENDING' },
          include: { task: { select: { title: true } } },
        });
        // Notify management
        const managers = await prisma.user.findMany({ where: { role: { in: ['OWNER', 'MANAGER', 'FLEET_MANAGER'] }, isActive: true } });
        for (const manager of managers) {
          const contact = await prisma.userContact.findFirst({ where: { userId: manager.id, channel: 'WHATSAPP' } });
          if (contact) {
            notifications.push({
              toUserId: manager.id, toPhone: contact.phoneNumber, messageType: 'TEXT',
              text: `⏰ Delay Request: ${user.name} requests to delay "${delayRequest.task.title}" until ${proposedDueDate.toISOString().split('T')[0]}. Reason: ${params.reason}.\nReply "APPROVE DELAY ${delayRequest.id}" or "REJECT DELAY ${delayRequest.id}"`,
            });
          }
        }
        return {
          success: true, tool, data: delayRequest,
          message: `Delay request submitted for "${delayRequest.task.title}" until ${proposedDueDate.toISOString().split('T')[0]}. Waiting for management approval.`,
          notifications,
          auditLog: { action: 'TOOL_REQUEST_DELAY', details: `Delay request ${delayRequest.id} for task ${task.id} by ${user.name}` },
        };
      }

      case 'approveTaskDelay': {
        const delayRequest = await prisma.delayRequest.findUnique({
          where: { id: params.delayRequestId },
          include: { task: true, requestedBy: { select: { name: true } } },
        });
        if (!delayRequest) {
          return { success: false, tool, data: null, message: `Delay request not found.`, notifications, auditLog: { action: 'TOOL_APPROVE_DELAY', details: 'Delay request not found' } };
        }
        if (delayRequest.status !== 'PENDING') {
          return { success: false, tool, data: null, message: `This delay request has already been ${delayRequest.status.toLowerCase()}.`, notifications, auditLog: { action: 'TOOL_APPROVE_DELAY', details: `Already ${delayRequest.status}` } };
        }
        const newStatus = params.approved ? 'APPROVED' : 'REJECTED';
        const updatedDelay = await prisma.delayRequest.update({
          where: { id: params.delayRequestId },
          data: { status: newStatus, approvedById: user.id, approvedAt: new Date() },
        });
        let taskUpdateMsg = '';
        if (params.approved) {
          await prisma.task.update({
            where: { id: delayRequest.taskId },
            data: { dueDate: delayRequest.proposedDueDate },
          });
          await prisma.botReminder.updateMany({
            where: { taskId: delayRequest.taskId, status: 'ACTIVE' },
            data: { nextReminderAt: calculateNextReminderAt(delayRequest.proposedDueDate) },
          });
          taskUpdateMsg = `Task deadline updated to ${delayRequest.proposedDueDate.toISOString().split('T')[0]}.`;
        }
        const requesterContact = await prisma.userContact.findFirst({
          where: { userId: delayRequest.requestedById, channel: 'WHATSAPP' },
        });
        if (requesterContact) {
          notifications.push({
            toUserId: delayRequest.requestedById, toPhone: requesterContact.phoneNumber, messageType: 'TEXT',
            text: `Your delay request for "${delayRequest.task.title}" has been ${newStatus.toLowerCase()} by ${user.name}.${params.note ? `\nNote: ${params.note}` : ''}${taskUpdateMsg ? `\n${taskUpdateMsg}` : ''}`,
          });
        }
        return {
          success: true, tool, data: updatedDelay,
          message: `Delay request ${newStatus.toLowerCase()}.${taskUpdateMsg ? ' ' + taskUpdateMsg : ''}`,
          notifications,
          auditLog: { action: 'TOOL_APPROVE_DELAY', details: `Delay ${delayRequest.id} ${newStatus} by ${user.name}` },
        };
      }

      case 'delegateTask': {
        let task: any = null;
        if (params.taskId) task = await prisma.task.findUnique({ where: { id: params.taskId } });
        else if (params.titleContains) {
          const tasks = await prisma.task.findMany({
            where: { title: { contains: params.titleContains, mode: 'insensitive' }, isDeleted: false, status: { not: 'COMPLETED' } },
            orderBy: { createdAt: 'desc' }, take: 1,
          });
          if (tasks.length > 0) task = tasks[0];
        }
        if (!task) {
          const activeTasks = await prisma.task.findMany({
            where: { assignedToId: user.id, isDeleted: false, status: { not: 'COMPLETED' } },
            orderBy: { createdAt: 'desc' }, take: 1,
          });
          if (activeTasks.length > 0) task = activeTasks[0];
        }
        if (!task) {
          return { success: false, tool, data: null, message: `No task found to delegate.`, notifications, auditLog: { action: 'TOOL_DELEGATE', details: 'No task found' } };
        }
        const isAssignee = task.assignedToId === user.id;
        const isCreator = task.createdById === user.id;
        const isOwner = user.role === 'OWNER';
        if (!isAssignee && !isCreator && !isOwner) {
          return { success: false, tool, data: null, message: `You do not have permission to delegate this task.`, notifications, auditLog: { action: 'TOOL_DELEGATE', details: `Permission denied for task ${task.id}` } };
        }
        const candidates = await BotService.resolveAssignee(params.assigneeName);
        if (candidates.length === 0) {
          return { success: false, tool, data: null, message: `Could not resolve assignee "${params.assigneeName}".`, notifications, auditLog: { action: 'TOOL_DELEGATE', details: `No assignee found: ${params.assigneeName}` } };
        }
        if (candidates.length > 1) {
          return {
            success: false, tool, data: null,
            message: `Multiple matches for "${params.assigneeName}". Which one?\n${candidates.map((c: any, i: number) => `${i + 1}. ${c.name}`).join('\n')}`,
            notifications, clarificationNeeded: true, clarificationOptions: candidates,
            auditLog: { action: 'TOOL_DELEGATE', details: `Ambiguous assignee: ${params.assigneeName}` },
          };
        }
        const newAssignee = candidates[0];
        const currentAssigneeId = task.assignedToId || task.createdById;
        await prisma.task.update({ where: { id: task.id }, data: { assignedToId: newAssignee.id, status: 'DELEGATED' } });
        await prisma.taskDelegationLog.create({
          data: { taskId: task.id, fromUserId: currentAssigneeId, toUserId: newAssignee.id, note: params.reason || 'Delegated via AI' },
        });
        await prisma.botReminder.updateMany({
          where: { taskId: task.id, status: 'ACTIVE' },
          data: { assignedToId: newAssignee.id },
        });
        const newAssigneeContact = await prisma.userContact.findFirst({ where: { userId: newAssignee.id, channel: 'WHATSAPP' } });
        if (newAssigneeContact) {
          notifications.push({
            toUserId: newAssignee.id, toPhone: newAssigneeContact.phoneNumber, messageType: 'INTERACTIVE_BUTTON',
            text: `New task delegated to you by ${user.name}: "${task.title}".${params.reason ? `\nReason: ${params.reason}` : ''}`, taskId: task.id,
          });
        }
        const creatorContact = await prisma.userContact.findFirst({ where: { userId: task.createdById, channel: 'WHATSAPP' } });
        if (creatorContact && task.createdById !== user.id) {
          notifications.push({
            toUserId: task.createdById, toPhone: creatorContact.phoneNumber, messageType: 'TEXT',
            text: `${user.name} delegated "${task.title}" to ${newAssignee.name}.${params.reason ? `\nReason: ${params.reason}` : ''}`,
          });
        }
        return {
          success: true, tool, data: task,
          message: `Task delegated to ${newAssignee.name}: "${task.title}".`,
          notifications,
          auditLog: { action: 'TOOL_DELEGATE', details: `Task ${task.id} delegated to ${newAssignee.name} by ${user.name}` },
        };
      }

      case 'cancelTask': {
        let task: any = null;
        if (params.taskId) task = await prisma.task.findUnique({ where: { id: params.taskId } });
        else if (params.titleContains) {
          const tasks = await prisma.task.findMany({
            where: { title: { contains: params.titleContains, mode: 'insensitive' }, isDeleted: false },
            orderBy: { createdAt: 'desc' }, take: 1,
          });
          if (tasks.length > 0) task = tasks[0];
        }
        if (!task) {
          return { success: false, tool, data: null, message: `Task not found.`, notifications, auditLog: { action: 'TOOL_CANCEL_TASK', details: 'Task not found' } };
        }
        if (task.taskType === 'ASSIGNED' && user.role !== 'OWNER') {
          return { success: false, tool, data: null, message: `Only the OWNER can cancel assigned tasks.`, notifications, auditLog: { action: 'TOOL_CANCEL_TASK', details: `Permission denied for task ${task.id}` } };
        }
        if (task.createdById !== user.id && user.role !== 'OWNER') {
          return { success: false, tool, data: null, message: `Only the creator or OWNER can cancel this task.`, notifications, auditLog: { action: 'TOOL_CANCEL_TASK', details: `Permission denied for task ${task.id}` } };
        }
        await prisma.task.update({
          where: { id: task.id },
          data: { isDeleted: true, deletedAt: new Date() },
        });
        await prisma.botReminder.updateMany({
          where: { taskId: task.id, status: 'ACTIVE' },
          data: { status: 'COMPLETED' },
        });
        return {
          success: true, tool, data: task,
          message: `Task "${task.title}" has been cancelled. Reason: ${params.reason}`,
          notifications,
          auditLog: { action: 'TOOL_CANCEL_TASK', details: `Task "${task.title}" (ID: ${task.id}) cancelled by ${user.name}. Reason: ${params.reason}` },
        };
      }

      case 'createReminder': {
        const remindAt = new Date(params.remindAt);
        if (isNaN(remindAt.getTime())) {
          return { success: false, tool, data: null, message: `Invalid reminder time: ${params.remindAt}`, notifications, auditLog: { action: 'TOOL_CREATE_REMINDER', details: `Invalid date: ${params.remindAt}` } };
        }
        const reminder = await prisma.personalReminder.create({
          data: { userId: user.id, title: params.title, description: params.description || null, remindAt, status: 'PENDING' },
        });
        return {
          success: true, tool, data: reminder,
          message: `Reminder set: "${reminder.title}" at ${reminder.remindAt.toISOString()}.`,
          notifications,
          auditLog: { action: 'TOOL_CREATE_REMINDER', details: `Personal reminder "${reminder.title}" set for ${reminder.remindAt.toISOString()}` },
        };
      }

      case 'acknowledgeTask': {
        let task: any = null;
        if (params.taskId) task = await prisma.task.findUnique({ where: { id: params.taskId } });
        else if (params.titleContains) {
          const tasks = await prisma.task.findMany({
            where: { title: { contains: params.titleContains, mode: 'insensitive' }, isDeleted: false, assignedToId: user.id },
            orderBy: { createdAt: 'desc' }, take: 1,
          });
          if (tasks.length > 0) task = tasks[0];
        }
        if (!task) {
          return { success: false, tool, data: null, message: `No active task found.`, notifications, auditLog: { action: 'TOOL_ACKNOWLEDGE', details: 'No task found' } };
        }
        if (task.assignedToId !== user.id) {
          return { success: false, tool, data: null, message: `You can only acknowledge tasks assigned to you.`, notifications, auditLog: { action: 'TOOL_ACKNOWLEDGE', details: `Not assigned to user ${user.id}` } };
        }
        await prisma.task.update({
          where: { id: task.id },
          data: { acknowledgedAt: new Date() },
        });
        return {
          success: true, tool, data: task,
          message: `Task acknowledged: "${task.title}".`,
          notifications,
          auditLog: { action: 'TOOL_ACKNOWLEDGE', details: `Task ${task.id} acknowledged by ${user.name}` },
        };
      }

      case 'getExpiringRegistries': {
        const certs = await CertsService.getExpiringCertificates(params.days);
        let filtered = certs;
        if (params.certType) filtered = filtered.filter((c: any) => c.certType === params.certType);
        if (params.assetName) filtered = filtered.filter((c: any) => c.vessel?.name?.toLowerCase().includes(params.assetName.toLowerCase()));
        return {
          success: true, tool, data: filtered,
          message: filtered.length > 0
            ? `Expiring within ${params.days} days (${filtered.length}):\n${filtered.map((c: any) => `• ${c.vessel?.name || 'Unknown'} — ${c.certType}: ${c.certNumber} expires ${c.expiryDate.toISOString().split('T')[0]} (${c.daysToExpiry} days left)`).join('\n')}`
            : `No certificates expiring within ${params.days} days.`,
          notifications,
          auditLog: { action: 'TOOL_GET_EXPIRING', details: `Found ${filtered.length} expiring certificates within ${params.days} days` },
        };
      }

      case 'updateRegistryExpiry': {
        const cert = await prisma.certification.findUnique({ where: { id: params.certificateId } });
        if (!cert) {
          return { success: false, tool, data: null, message: `Certificate not found.`, notifications, auditLog: { action: 'TOOL_UPDATE_REGISTRY', details: `Certificate ${params.certificateId} not found` } };
        }
        const newExpiry = new Date(params.newExpiryDate);
        const newIssue = params.newIssueDate ? new Date(params.newIssueDate) : undefined;
        const status = CertsService.computeStatus(newExpiry);
        const updated = await prisma.certification.update({
          where: { id: params.certificateId },
          data: {
            expiryDate: newExpiry,
            ...(newIssue && { issueDate: newIssue }),
            ...(params.documentUrl && { documentUrl: params.documentUrl }),
            status,
            reminderClosed: false,
          },
        });
        return {
          success: true, tool, data: updated,
          message: `✅ Certificate updated.\nNew expiry: ${newExpiry.toISOString().split('T')[0]}\nStatus: ${status}${params.remarks ? `\nRemarks: ${params.remarks}` : ''}`,
          notifications,
          auditLog: { action: 'TOOL_UPDATE_REGISTRY', details: `Certificate ${params.certificateId} updated to ${newExpiry.toISOString().split('T')[0]} by ${user.name}` },
        };
      }

      case 'getCompanySummary': {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
        const [totalVessels, activeVessels, totalTasks, pendingTasks, overdueTasks, expiringCerts] = await Promise.all([
          prisma.vessel.count({ where: { deletedAt: null } }),
          prisma.vessel.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
          prisma.task.count({ where: { isDeleted: false } }),
          prisma.task.count({ where: { isDeleted: false, status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
          prisma.task.count({ where: { isDeleted: false, status: 'OVERDUE' } }),
          CertsService.getExpiringCertificates(90),
        ]);
        return {
          success: true, tool, data: { totalVessels, activeVessels, totalTasks, pendingTasks, overdueTasks, expiringCerts: expiringCerts.length },
          message: `📊 Company Summary\n\n🚢 Vessels: ${activeVessels}/${totalVessels} active\n📋 Tasks: ${pendingTasks} pending, ${overdueTasks} overdue\n⚠️ Certificates expiring in 90 days: ${expiringCerts.length}\n\n_Data as of ${today.toISOString().split('T')[0]}_`,
          notifications,
          auditLog: { action: 'TOOL_GET_COMPANY_SUMMARY', details: `Summary generated for ${params.period}` },
        };
      }

      case 'getComplianceSummary': {
        const certs = await CertsService.getExpiringCertificates(params.days);
        const expired = certs.filter((c: any) => c.status === 'EXPIRED');
        const expiringSoon = certs.filter((c: any) => c.status === 'EXPIRING_SOON');
        const overdueTasks = await prisma.task.count({ where: { isDeleted: false, status: 'OVERDUE' } });
        return {
          success: true, tool, data: { expired: expired.length, expiringSoon: expiringSoon.length, overdueTasks },
          message: `⚠️ Compliance Summary\n\nExpired Certificates: ${expired.length}\nExpiring Soon (≤30 days): ${expiringSoon.length}\nOverdue Tasks: ${overdueTasks}\n\n_Data as of ${new Date().toISOString().split('T')[0]}_`,
          notifications,
          auditLog: { action: 'TOOL_GET_COMPLIANCE_SUMMARY', details: `Compliance summary generated for ${params.days} days` },
        };
      }

      case 'sendAssetDocument': {
        const { BotDocumentService } = require('./bot.document-service');
        const { WhatsAppService } = require('./whatsapp.service');
        const docRecord = await BotDocumentService.getDocumentRecord(params.assetName, params.docType);
        if (!docRecord || !docRecord.doc) {
          const replyText = await BotDocumentService.getDocumentReply(params.assetName, params.docType);
          return {
            success: false, tool, data: null, message: replyText, notifications,
            auditLog: { action: 'TOOL_SEND_ASSET_DOCUMENT', details: `Vessel document not found: ${params.assetName} - ${params.docType}` }
          };
        }

        if (user.phone) {
          await WhatsAppService.sendWhatsAppDocumentAndLog(
            user.id,
            user.phone,
            docRecord.url,
            docRecord.doc.fileName,
            `📄 ${docRecord.doc.description || docRecord.doc.fileName}`
          );
          return {
            success: true, tool, data: docRecord.doc,
            message: `📄 I've retrieved and sent the ${params.docType.toLowerCase().replace('_', ' ')} for ${docRecord.vessel.name} to your WhatsApp.`,
            notifications,
            auditLog: { action: 'TOOL_SEND_ASSET_DOCUMENT', details: `Sent document ${docRecord.doc.fileName} to user ${user.name}` }
          };
        } else {
          return {
            success: false, tool, data: docRecord.doc,
            message: `Could not send document: no WhatsApp phone number available in context.`,
            notifications,
            auditLog: { action: 'TOOL_SEND_ASSET_DOCUMENT', details: `Failed to send document to ${user.name}: no phone` }
          };
        }
      }

      case 'searchTasks': {
        const where: any = { isDeleted: false };
        if (params.query) {
          where.title = { contains: params.query, mode: 'insensitive' };
        }
        if (params.status) {
          where.status = params.status;
        }
        if (params.assigneeName) {
          const candidates = await BotService.resolveAssignee(params.assigneeName);
          if (candidates.length > 0) {
            where.assignedToId = { in: candidates.map(c => c.id) };
          }
        }
        if (params.creatorName) {
          const candidates = await BotService.resolveAssignee(params.creatorName);
          if (candidates.length > 0) {
            where.createdById = { in: candidates.map(c => c.id) };
          }
        }

        const tasks = await prisma.task.findMany({
          where,
          include: { assignee: { select: { name: true } }, creator: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20
        });

        const listText = tasks.map((t, idx) => 
          `${idx + 1}. "${t.title}" [${t.status}] (Assignee: ${t.assignee?.name || 'Unassigned'}, Creator: ${t.creator?.name || 'System'}, Due: ${t.dueDate ? t.dueDate.toISOString().split('T')[0] : 'None'})`
        ).join('\n');

        return {
          success: true, tool, data: tasks,
          message: tasks.length > 0 ? `Found ${tasks.length} task(s):\n${listText}` : `No tasks found matching query.`,
          notifications,
          auditLog: { action: 'TOOL_SEARCH_TASKS', details: `Searched tasks matching: ${JSON.stringify(where)}` }
        };
      }

      case 'addTaskComment': {
        let taskId = params.taskId;
        if (!taskId) {
          const activeTasks = await prisma.task.findMany({
            where: { assignedToId: user.id, isDeleted: false, status: { not: 'COMPLETED' } },
            orderBy: { createdAt: 'desc' },
            take: 1,
          });
          if (activeTasks.length > 0) {
            taskId = activeTasks[0].id;
          }
        }
        if (!taskId) {
          return {
            success: false, tool, data: null, message: `No active task found to comment on.`, notifications,
            auditLog: { action: 'TOOL_ADD_TASK_COMMENT', details: `Failed: no active task found for user ${user.name}` }
          };
        }
        const comment = await prisma.taskComment.create({
          data: {
            taskId,
            userId: user.id,
            content: params.content
          },
          include: {
            task: true
          }
        });

        // Notify the other party on WhatsApp
        const task = comment.task;
        const recipientId = (user.id === task.createdById) ? task.assignedToId : task.createdById;
        if (recipientId) {
          const recipientContact = await prisma.userContact.findFirst({
            where: { userId: recipientId, channel: 'WHATSAPP' }
          });
          const { WhatsAppService } = require('./whatsapp.service');
          if (recipientContact) {
            notifications.push({
              toUserId: recipientId,
              toPhone: recipientContact.phoneNumber,
              messageType: 'TEXT',
              text: `💬 New comment from ${user.name} on task "${task.title}":\n"${params.content}"`
            });
          }
        }

        return {
          success: true, tool, data: comment,
          message: `Comment added to task "${task.title}".`,
          notifications,
          auditLog: { action: 'TOOL_ADD_TASK_COMMENT', details: `Added comment to task ${params.taskId}: "${params.content}"` }
        };
      }

      case 'getTaskDetails': {
        const task = await prisma.task.findUnique({
          where: { id: params.taskId },
          include: {
            assignee: { select: { name: true, department: true } },
            creator: { select: { name: true } },
            comments: {
              include: { user: { select: { name: true } } },
              orderBy: { createdAt: 'asc' }
            },
            delegationLogs: {
              include: {
                fromUser: { select: { name: true } },
                toUser: { select: { name: true } }
              },
              orderBy: { delegatedAt: 'asc' }
            }
          }
        });

        if (!task) {
          return {
            success: false, tool, data: null, message: `Task not found.`, notifications,
            auditLog: { action: 'TOOL_GET_TASK_DETAILS', details: `Task not found: ${params.taskId}` }
          };
        }

        const commentsText = task.comments.map(c => `• [${c.createdAt.toISOString().split('T')[0]}] ${c.user.name}: ${c.content}`).join('\n') || 'No comments.';
        const historyText = task.delegationLogs.map(l => `• [${l.delegatedAt.toISOString().split('T')[0]}] Delegated from ${l.fromUser.name} to ${l.toUser.name}${l.note ? ` (${l.note})` : ''}`).join('\n') || 'No delegation history.';

        return {
          success: true, tool, data: task,
          message: `*Task: "${task.title}"*\nStatus: ${task.status} | Priority: ${task.priority}\nAssigned to: ${task.assignee?.name || 'Unassigned'} | Created by: ${task.creator?.name}\nDue Date: ${task.dueDate ? task.dueDate.toISOString().split('T')[0] : 'None'}\nDescription: ${task.description || 'No description.'}\n\n💬 Comments:\n${commentsText}\n\n🔁 History:\n${historyText}`,
          notifications,
          auditLog: { action: 'TOOL_GET_TASK_DETAILS', details: `Retrieved details for task ${task.id}` }
        };
      }

      case 'searchDocuments': {
        const where: any = {};
        if (params.docType) {
          where.docType = params.docType;
        }
        if (params.query) {
          where.OR = [
            { fileName: { contains: params.query, mode: 'insensitive' } },
            { description: { contains: params.query, mode: 'insensitive' } }
          ];
        }
        if (params.vesselName) {
          where.vessel = { name: { contains: params.vesselName, mode: 'insensitive' } };
        }

        const docs = await prisma.vesselDocument.findMany({
          where,
          include: { vessel: { select: { name: true } } },
          orderBy: { fileName: 'asc' },
          take: 20
        });

        const listText = docs.map((d, idx) => 
          `${idx + 1}. ${d.vessel.name} - ${d.docType}: ${d.fileName} (${d.description || 'No desc'})`
        ).join('\n');

        return {
          success: true, tool, data: docs,
          message: docs.length > 0 ? `Found ${docs.length} document(s):\n${listText}` : `No documents found matching query.`,
          notifications,
          auditLog: { action: 'TOOL_SEARCH_DOCUMENTS', details: `Searched documents matching: ${JSON.stringify(where)}` }
        };
      }

      default:
        return {
          success: false, tool, data: null, message: `Tool "${tool}" not yet implemented.`, notifications,
          auditLog: { action: 'TOOL_NOT_IMPLEMENTED', details: `Tool ${tool} not implemented` },
        };
    }
  }
}
