import { z } from 'zod';
import { TaskType, Priority, TaskStatus } from '@prisma/client';

const parseDateString = (val: string): Date => {
  let date: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    date = new Date(`${val}T00:00:00.000Z`);
  } else {
    date = new Date(val);
  }

  if (isNaN(date.getTime())) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD or standard ISO-8601 DateTime.');
  }
  return date;
};

export const createTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(255),
    description: z.string().optional(),
    taskType: z.nativeEnum(TaskType, {
      required_error: 'Task type is required',
    }),
    assignedToId: z.string().uuid('Invalid assignee ID format').optional().nullable(),
    dueDate: z.string().transform((val, ctx) => {
      try {
        return parseDateString(val);
      } catch (err: any) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err.message,
        });
        return z.NEVER;
      }
    }).optional().nullable(),
    priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
    status: z.nativeEnum(TaskStatus).default(TaskStatus.PENDING),
  }).superRefine((data, ctx) => {
    if (data.taskType === TaskType.ASSIGNED) {
      if (!data.assignedToId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['assignedToId'],
          message: 'Assignee is required for assigned tasks',
        });
      }
      if (!data.dueDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dueDate'],
          message: 'Due date is required for assigned tasks',
        });
      }
    } else if (data.taskType === TaskType.PERSONAL) {
      if (data.assignedToId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['assignedToId'],
          message: 'Personal tasks cannot have an assignee (assignedToId must be null)',
        });
      }
    }
  }),
});

export const updateStatusSchema = z.object({
  body: z.object({
    status: z.string().transform((val, ctx) => {
      const upper = val.toUpperCase();
      if (['PENDING', 'IN_PROGRESS', 'DELEGATED', 'COMPLETED', 'OVERDUE'].includes(upper)) {
        return upper as TaskStatus;
      }
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid status. Expected one of: PENDING, IN_PROGRESS, DELEGATED, COMPLETED, OVERDUE`,
      });
      return z.NEVER;
    }),
  }),
});

export const delegateTaskSchema = z.object({
  body: z.object({
    assignedToId: z.string().uuid('Invalid assignee ID format'),
    note: z.string().optional(),
  }),
});

export const addCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1, 'Comment content cannot be empty'),
  }),
});

// Zod schema to validate and normalize GET query params
export const getTasksQuerySchema = z.object({
  query: z.object({
    type: z.string().optional().transform((val, ctx) => {
      if (!val) return undefined;
      const upper = val.toUpperCase();
      if (upper === 'ASSIGNED' || upper === 'PERSONAL') {
        return upper as TaskType;
      }
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid task type. Expected: ASSIGNED or PERSONAL',
      });
      return z.NEVER;
    }),
    status: z.string().optional().transform((val, ctx) => {
      if (!val) return undefined;
      const upper = val.toUpperCase();
      if (['PENDING', 'IN_PROGRESS', 'DELEGATED', 'COMPLETED', 'OVERDUE'].includes(upper)) {
        return upper as TaskStatus;
      }
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid task status.',
      });
      return z.NEVER;
    }),
    priority: z.string().optional().transform((val, ctx) => {
      if (!val) return undefined;
      const upper = val.toUpperCase();
      if (['HIGH', 'MEDIUM', 'LOW'].includes(upper)) {
        return upper as Priority;
      }
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid task priority. Expected: HIGH, MEDIUM, or LOW',
      });
      return z.NEVER;
    }),
    overdue: z.string().optional().transform((val) => {
      if (!val) return undefined;
      return val === 'true';
    }),
  }),
});
