import { z } from 'zod';

export const testCommandSchema = z.object({
  body: z.object({
    message: z.string({
      required_error: 'Message is required',
    }).min(1, 'Message cannot be empty'),
  }),
});

export const personalReminderSchema = z.object({
  body: z.object({
    title: z.string({
      required_error: 'Title is required',
    }).min(1, 'Title cannot be empty'),
    description: z.string().optional(),
    remindAt: z.string({
      required_error: 'remindAt is required',
    }).refine((val) => !isNaN(new Date(val).getTime()), {
      message: 'remindAt must be a valid date string',
    }),
  }),
});
