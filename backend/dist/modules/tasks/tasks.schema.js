"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTasksQuerySchema = exports.addCommentSchema = exports.delegateTaskSchema = exports.updateStatusSchema = exports.createTaskSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const parseDateString = (val) => {
    let date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        date = new Date(`${val}T00:00:00.000Z`);
    }
    else {
        date = new Date(val);
    }
    if (isNaN(date.getTime())) {
        throw new Error('Invalid date format. Expected YYYY-MM-DD or standard ISO-8601 DateTime.');
    }
    return date;
};
exports.createTaskSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().min(1, 'Title is required').max(255),
        description: zod_1.z.string().optional(),
        taskType: zod_1.z.nativeEnum(client_1.TaskType, {
            required_error: 'Task type is required',
        }),
        assignedToId: zod_1.z.string().uuid('Invalid assignee ID format').optional().nullable(),
        dueDate: zod_1.z.string().transform((val, ctx) => {
            try {
                return parseDateString(val);
            }
            catch (err) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
                    message: err.message,
                });
                return zod_1.z.NEVER;
            }
        }).optional().nullable(),
        priority: zod_1.z.nativeEnum(client_1.Priority).default(client_1.Priority.MEDIUM),
        status: zod_1.z.nativeEnum(client_1.TaskStatus).default(client_1.TaskStatus.PENDING),
    }).superRefine((data, ctx) => {
        if (data.taskType === client_1.TaskType.ASSIGNED) {
            if (!data.assignedToId) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
                    path: ['assignedToId'],
                    message: 'Assignee is required for assigned tasks',
                });
            }
            if (!data.dueDate) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
                    path: ['dueDate'],
                    message: 'Due date is required for assigned tasks',
                });
            }
        }
        else if (data.taskType === client_1.TaskType.PERSONAL) {
            if (data.assignedToId) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
                    path: ['assignedToId'],
                    message: 'Personal tasks cannot have an assignee (assignedToId must be null)',
                });
            }
        }
    }),
});
exports.updateStatusSchema = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z.string().transform((val, ctx) => {
            const upper = val.toUpperCase();
            if (['PENDING', 'IN_PROGRESS', 'DELEGATED', 'COMPLETED', 'OVERDUE'].includes(upper)) {
                return upper;
            }
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: `Invalid status. Expected one of: PENDING, IN_PROGRESS, DELEGATED, COMPLETED, OVERDUE`,
            });
            return zod_1.z.NEVER;
        }),
    }),
});
exports.delegateTaskSchema = zod_1.z.object({
    body: zod_1.z.object({
        assignedToId: zod_1.z.string().uuid('Invalid assignee ID format'),
        note: zod_1.z.string().optional(),
    }),
});
exports.addCommentSchema = zod_1.z.object({
    body: zod_1.z.object({
        content: zod_1.z.string().min(1, 'Comment content cannot be empty'),
    }),
});
// Zod schema to validate and normalize GET query params
exports.getTasksQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        type: zod_1.z.string().optional().transform((val, ctx) => {
            if (!val)
                return undefined;
            const upper = val.toUpperCase();
            if (upper === 'ASSIGNED' || upper === 'PERSONAL') {
                return upper;
            }
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'Invalid task type. Expected: ASSIGNED or PERSONAL',
            });
            return zod_1.z.NEVER;
        }),
        status: zod_1.z.string().optional().transform((val, ctx) => {
            if (!val)
                return undefined;
            const upper = val.toUpperCase();
            if (['PENDING', 'IN_PROGRESS', 'DELEGATED', 'COMPLETED', 'OVERDUE'].includes(upper)) {
                return upper;
            }
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'Invalid task status.',
            });
            return zod_1.z.NEVER;
        }),
        priority: zod_1.z.string().optional().transform((val, ctx) => {
            if (!val)
                return undefined;
            const upper = val.toUpperCase();
            if (['HIGH', 'MEDIUM', 'LOW'].includes(upper)) {
                return upper;
            }
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'Invalid task priority. Expected: HIGH, MEDIUM, or LOW',
            });
            return zod_1.z.NEVER;
        }),
        overdue: zod_1.z.string().optional().transform((val) => {
            if (!val)
                return undefined;
            return val === 'true';
        }),
    }),
});
