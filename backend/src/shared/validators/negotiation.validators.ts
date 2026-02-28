import { z } from 'zod';

export const createNegotiationSchema = z.object({
  invited_supplier_ids: z
    .array(z.string().uuid('Each supplier ID must be a valid UUID'))
    .min(2, 'At least 2 suppliers must be invited'),
  max_revisions: z.number().int().min(1).max(100),
  min_change_percent: z.number().min(0).max(100),
  cooling_time_minutes: z.number().int().min(0).max(1440),
  bid_open_at: z.string().datetime({ message: 'bid_open_at must be a valid ISO datetime' }),
  bid_close_at: z.string().datetime({ message: 'bid_close_at must be a valid ISO datetime' }),
  anti_snipe_window_minutes: z.number().int().min(0).max(120).optional().default(10),
  anti_snipe_extension_minutes: z.number().int().min(0).max(120).optional().default(5),
});

export type CreateNegotiationInput = z.infer<typeof createNegotiationSchema>;

export const closeNegotiationSchema = z.object({
  confirm: z.literal(true, {
    errorMap: () => ({ message: 'Confirmation is required (confirm: true)' }),
  }),
});

export type CloseNegotiationInput = z.infer<typeof closeNegotiationSchema>;

export const awardNegotiationSchema = z.object({
  type: z.enum(['single', 'split']),
  allocations: z
    .array(
      z.object({
        supplier_id: z.string().uuid(),
        item_ids: z.array(z.string().uuid()).optional(),
      }),
    )
    .min(1, 'At least one allocation is required'),
});

export type AwardNegotiationInput = z.infer<typeof awardNegotiationSchema>;
