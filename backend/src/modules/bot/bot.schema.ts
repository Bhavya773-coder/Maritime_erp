import { z } from 'zod';

export const testCommandSchema = z.object({
  body: z.object({
    message: z.string({
      required_error: 'Message is required',
    }).min(1, 'Message cannot be empty'),
  }),
});
