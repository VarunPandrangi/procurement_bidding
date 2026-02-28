import { z } from 'zod';

export const fulfillRfqSchema = z.object({
  supplier_id: z.string().uuid('Invalid supplier ID'),
});

export type FulfillRfqInput = z.infer<typeof fulfillRfqSchema>;
