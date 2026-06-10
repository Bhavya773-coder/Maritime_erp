"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TasksService = void 0;
const db_1 = __importDefault(require("../../config/db"));
const error_1 = require("../../middleware/error");
const client_1 = require("@prisma/client");
class TasksService {
    /**
     * Helper to check if a user is in the delegation chain of a task
     */
    static async isUserInChain(taskId, userId) {
        const logs = await db_1.default.taskDelegationLog.findMany({
            where: { taskId },
            select: { fromUserId: true, toUserId: true },
        });
        return logs.some(log => log.fromUserId === userId || log.toUserId === userId);
    }
    /**
     * Helper to verify if user has view access to a task
     */
    static async verifyViewAccess(task, userId, role) {
        if (role === client_1.Role.OWNER)
            return true;
        if (task.createdById === userId)
            return true;
        if (task.assignedToId === userId)
            return true;
        // Check delegation chain
        const inChain = await this.isUserInChain(task.id, userId);
        if (inChain)
            return true;
        return false;
    }
    /**
     * List tasks with role filtering and query filters
     */
    static async getTasks(filters, user) {
        const whereClause = {
            deletedAt: null,
            isDeleted: false,
        };
        // Apply role-based visibility filter
        if (user.role !== client_1.Role.OWNER) {
            if (user.role === client_1.Role.MANAGER) {
                // MANAGER sees tasks created by them or assigned to them
                whereClause.OR = [
                    { createdById: user.id },
                    { assignedToId: user.id },
                    // Also allow seeing delegated tasks where they are in the chain
                    { delegationLogs: { some: { OR: [{ fromUserId: user.id }, { toUserId: user.id }] } } }
                ];
            }
            else {
                // Staff/Accounts see tasks created by them or assigned to them or in their chain
                whereClause.OR = [
                    { createdById: user.id },
                    { assignedToId: user.id },
                    { delegationLogs: { some: { OR: [{ fromUserId: user.id }, { toUserId: user.id }] } } }
                ];
            }
        }
        // Apply query filters
        if (filters.type) {
            whereClause.taskType = filters.type;
        }
        if (filters.status) {
            whereClause.status = filters.status;
        }
        if (filters.priority) {
            whereClause.priority = filters.priority;
        }
        if (filters.overdue !== undefined) {
            if (filters.overdue) {
                whereClause.status = client_1.TaskStatus.OVERDUE;
            }
            else {
                whereClause.status = { not: client_1.TaskStatus.OVERDUE };
            }
        }
        return db_1.default.task.findMany({
            where: whereClause,
            include: {
                creator: { select: { id: true, name: true, email: true, role: true } },
                assignee: { select: { id: true, name: true, email: true, role: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    /**
     * Get all tasks (Owner only)
     */
    static async getAllTasksForOwner() {
        const tasks = await db_1.default.task.findMany({
            where: { deletedAt: null },
            include: {
                creator: { select: { id: true, name: true, email: true, role: true } },
                assignee: { select: { id: true, name: true, email: true, role: true } },
                _count: {
                    select: {
                        delegationLogs: true,
                        comments: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return tasks.map(task => {
            // Latest holder: assignee for ASSIGNED tasks, creator for PERSONAL tasks
            const latestHolder = task.taskType === client_1.TaskType.ASSIGNED
                ? task.assignee?.name || 'Unassigned'
                : task.creator.name;
            return {
                id: task.id,
                title: task.title,
                taskType: task.taskType,
                status: task.status,
                priority: task.priority,
                dueDate: task.dueDate,
                completedAt: task.completedAt,
                createdAt: task.createdAt,
                creator: {
                    name: task.creator.name,
                    email: task.creator.email,
                },
                assignee: task.assignee ? {
                    name: task.assignee.name,
                    email: task.assignee.email,
                } : null,
                latestHolder,
                delegationCount: task._count.delegationLogs,
                commentsCount: task._count.comments,
            };
        });
    }
    /**
     * Create task
     */
    static async createTask(data, creator) {
        // Check validation constraints
        if (data.taskType === client_1.TaskType.PERSONAL) {
            data.assignedToId = null;
        }
        if (data.taskType === client_1.TaskType.ASSIGNED) {
            if (!data.assignedToId) {
                throw new error_1.AppError('Assignee is required for assigned tasks.', 400);
            }
            if (!data.dueDate) {
                throw new error_1.AppError('Due date is required for assigned tasks.', 400);
            }
            // Check permission: only OWNER or MANAGER can assign
            if (creator.role !== client_1.Role.OWNER && creator.role !== client_1.Role.MANAGER) {
                throw new error_1.AppError('Only owners or managers can create assigned tasks.', 403);
            }
            // Check if assignee is active
            const assignee = await db_1.default.user.findUnique({
                where: { id: data.assignedToId },
            });
            if (!assignee) {
                throw new error_1.AppError('The assigned user does not exist.', 400);
            }
            if (!assignee.isActive) {
                throw new error_1.AppError('The assigned user is inactive.', 400);
            }
        }
        // Create task
        const task = await db_1.default.task.create({
            data: {
                title: data.title,
                description: data.description,
                taskType: data.taskType,
                createdById: creator.id,
                assignedToId: data.assignedToId || null,
                dueDate: data.dueDate ? data.dueDate : new Date(), // Default current date if personal omitted
                priority: data.priority,
                status: data.status,
            },
            include: {
                creator: { select: { id: true, name: true, email: true, role: true } },
                assignee: { select: { id: true, name: true, email: true, role: true } },
            },
        });
        // If assigned, log initial delegation log
        if (task.taskType === client_1.TaskType.ASSIGNED && task.assignedToId) {
            await db_1.default.taskDelegationLog.create({
                data: {
                    taskId: task.id,
                    fromUserId: creator.id,
                    toUserId: task.assignedToId,
                    note: 'Initial assignment',
                },
            });
        }
        // Log to AuditLog
        await db_1.default.auditLog.create({
            data: {
                userId: creator.id,
                action: 'TASK_CREATED',
                details: `Task "${task.title}" (${task.taskType}) created by ${creator.name}.`,
            },
        });
        return task;
    }
    /**
     * Get task details
     */
    static async getTaskDetails(id, user) {
        const task = await db_1.default.task.findUnique({
            where: { id, deletedAt: null },
            include: {
                creator: { select: { id: true, name: true, email: true, role: true, department: true } },
                assignee: { select: { id: true, name: true, email: true, role: true, department: true } },
                delegationLogs: {
                    include: {
                        fromUser: { select: { id: true, name: true, email: true } },
                        toUser: { select: { id: true, name: true, email: true } },
                    },
                    orderBy: { delegatedAt: 'asc' },
                },
                comments: {
                    include: {
                        user: { select: { id: true, name: true, email: true, role: true } },
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
        if (!task) {
            throw new error_1.AppError('Task not found.', 404);
        }
        // Check authorization
        const hasAccess = await this.verifyViewAccess(task, user.id, user.role);
        if (!hasAccess) {
            throw new error_1.AppError('Access denied. You do not have permission to view this task.', 403);
        }
        const latestHolder = task.taskType === client_1.TaskType.ASSIGNED
            ? task.assignee?.name || 'Unassigned'
            : task.creator.name;
        return {
            ...task,
            latestHolder,
        };
    }
    /**
     * Update task status
     */
    static async updateTaskStatus(id, status, user) {
        const task = await db_1.default.task.findUnique({
            where: { id, deletedAt: null },
        });
        if (!task) {
            throw new error_1.AppError('Task not found.', 404);
        }
        // Check permission rules
        if (task.taskType === client_1.TaskType.PERSONAL) {
            if (task.createdById !== user.id) {
                throw new error_1.AppError('Only the creator can update the status of a personal task.', 403);
            }
        }
        else {
            // ASSIGNED task rules: current holder (assignee), creator, OWNER, or MANAGER can update
            const isHolder = task.assignedToId === user.id;
            const isCreator = task.createdById === user.id;
            const isOwner = user.role === client_1.Role.OWNER;
            const isManager = user.role === client_1.Role.MANAGER;
            if (!isHolder && !isCreator && !isOwner && !isManager) {
                throw new error_1.AppError('You do not have permission to update this task\'s status.', 403);
            }
        }
        // Enforce lock: Cannot change COMPLETED task back to another status unless OWNER
        if (task.status === client_1.TaskStatus.COMPLETED && status !== client_1.TaskStatus.COMPLETED && user.role !== client_1.Role.OWNER) {
            throw new error_1.AppError('Completed tasks can only be reopened by the OWNER.', 403);
        }
        // Update fields
        const completedAt = status === client_1.TaskStatus.COMPLETED ? new Date() : null;
        const updatedTask = await db_1.default.task.update({
            where: { id },
            data: {
                status,
                completedAt,
            },
            include: {
                creator: { select: { id: true, name: true, email: true } },
                assignee: { select: { id: true, name: true, email: true } },
            },
        });
        // Write to AuditLog
        await db_1.default.auditLog.create({
            data: {
                userId: user.id,
                action: 'TASK_STATUS_UPDATED',
                details: `Task "${task.title}" status changed from ${task.status} to ${status} by ${user.name}.`,
            },
        });
        return updatedTask;
    }
    /**
     * Delegate task
     */
    static async delegateTask(id, targetUserId, note, user) {
        const task = await db_1.default.task.findUnique({
            where: { id, deletedAt: null },
        });
        if (!task) {
            throw new error_1.AppError('Task not found.', 404);
        }
        // PERSONAL task cannot be delegated
        if (task.taskType === client_1.TaskType.PERSONAL) {
            throw new error_1.AppError('Personal tasks cannot be delegated.', 403);
        }
        // Only current assignee (holder), OWNER, or original creator can delegate
        const isHolder = task.assignedToId === user.id;
        const isCreator = task.createdById === user.id;
        const isOwner = user.role === client_1.Role.OWNER;
        if (!isHolder && !isCreator && !isOwner) {
            throw new error_1.AppError('You do not have permission to delegate this task.', 403);
        }
        // Target user must exist and be active
        const targetUser = await db_1.default.user.findUnique({
            where: { id: targetUserId },
        });
        if (!targetUser) {
            throw new error_1.AppError('The target user does not exist.', 400);
        }
        if (!targetUser.isActive) {
            throw new error_1.AppError('The target user is inactive.', 400);
        }
        // Create Delegation Log
        const currentAssigneeId = task.assignedToId || task.createdById; // Fallback in case of orphan
        await db_1.default.taskDelegationLog.create({
            data: {
                taskId: task.id,
                fromUserId: currentAssigneeId,
                toUserId: targetUserId,
                note: note || 'Delegated',
            },
        });
        // Update Task
        const updatedTask = await db_1.default.task.update({
            where: { id },
            data: {
                assignedToId: targetUserId,
                status: client_1.TaskStatus.DELEGATED,
            },
        });
        // Write to AuditLog
        await db_1.default.auditLog.create({
            data: {
                userId: user.id,
                action: 'TASK_DELEGATED',
                details: `Task "${task.title}" delegated to ${targetUser.name} by ${user.name}.`,
            },
        });
        // Return full updated chain
        return this.getDelegationChain(task.id, user);
    }
    /**
     * Add comment to task
     */
    static async addTaskComment(id, content, user) {
        const task = await db_1.default.task.findUnique({
            where: { id, deletedAt: null },
        });
        if (!task) {
            throw new error_1.AppError('Task not found.', 404);
        }
        // Validate view access before allowing comments
        const hasAccess = await this.verifyViewAccess(task, user.id, user.role);
        if (!hasAccess) {
            throw new error_1.AppError('Access denied. You cannot comment on a task you cannot view.', 403);
        }
        const comment = await db_1.default.taskComment.create({
            data: {
                taskId: id,
                userId: user.id,
                content,
            },
            include: {
                user: { select: { id: true, name: true, email: true, role: true } },
            },
        });
        return comment;
    }
    /**
     * Get delegation chain
     */
    static async getDelegationChain(id, user) {
        const task = await db_1.default.task.findUnique({
            where: { id, deletedAt: null },
            include: {
                creator: { select: { id: true, name: true, email: true } },
                delegationLogs: {
                    include: {
                        fromUser: { select: { id: true, name: true, email: true } },
                        toUser: { select: { id: true, name: true, email: true } },
                    },
                    orderBy: { delegatedAt: 'asc' },
                },
            },
        });
        if (!task) {
            throw new error_1.AppError('Task not found.', 404);
        }
        const hasAccess = await this.verifyViewAccess(task, user.id, user.role);
        if (!hasAccess) {
            throw new error_1.AppError('Access denied. You do not have permission to view the chain of this task.', 403);
        }
        // Format the chain output
        return {
            taskId: task.id,
            title: task.title,
            originalCreator: task.creator,
            steps: task.delegationLogs.map(log => ({
                from: log.fromUser,
                to: log.toUser,
                timestamp: log.delegatedAt,
                note: log.note,
            })),
            currentHolder: task.delegationLogs[task.delegationLogs.length - 1]?.toUser || task.creator,
        };
    }
    /**
     * Delete task
     */
    static async deleteTask(id, user) {
        const task = await db_1.default.task.findUnique({
            where: { id, deletedAt: null },
        });
        if (!task) {
            throw new error_1.AppError('Task not found.', 404);
        }
        // Rule: Assigned tasks must never be deleted
        if (task.taskType === client_1.TaskType.ASSIGNED) {
            throw new error_1.AppError('Assigned tasks cannot be deleted. Mark as completed instead.', 403);
        }
        // Personal tasks delete rules: Only creator or OWNER can delete
        if (task.createdById !== user.id && user.role !== client_1.Role.OWNER) {
            throw new error_1.AppError('Only the creator or an OWNER can delete this personal task.', 403);
        }
        // Soft delete
        const deletedTask = await db_1.default.task.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                isDeleted: true,
            },
        });
        // Write to AuditLog
        await db_1.default.auditLog.create({
            data: {
                userId: user.id,
                action: 'TASK_DELETED',
                details: `Personal task "${task.title}" soft deleted by ${user.name}.`,
            },
        });
        return deletedTask;
    }
    /**
     * Mark tasks overdue
     */
    static async markTasksOverdue(user) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nonCompleted = await db_1.default.task.findMany({
            where: {
                deletedAt: null,
                status: { notIn: [client_1.TaskStatus.COMPLETED, client_1.TaskStatus.OVERDUE] },
                dueDate: { lt: today },
            },
            select: { id: true, title: true },
        });
        if (nonCompleted.length === 0) {
            return 0;
        }
        // Bulk update
        const result = await db_1.default.task.updateMany({
            where: {
                deletedAt: null,
                status: { notIn: [client_1.TaskStatus.COMPLETED, client_1.TaskStatus.OVERDUE] },
                dueDate: { lt: today },
            },
            data: {
                status: client_1.TaskStatus.OVERDUE,
            },
        });
        // Log to AuditLog
        await db_1.default.auditLog.create({
            data: {
                userId: user.id,
                action: 'TASKS_MARKED_OVERDUE',
                details: `Identified and marked ${result.count} tasks as OVERDUE. Tasks: [${nonCompleted.map(t => t.title).join(', ')}].`,
            },
        });
        return result.count;
    }
}
exports.TasksService = TasksService;
