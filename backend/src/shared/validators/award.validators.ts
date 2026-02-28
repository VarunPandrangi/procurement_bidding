import { z } from 'zod';

export const closeRfqSchema = z.object({
  confirm: z.literal(true, {
    errorMap: () => ({ message: 'Confirmation is required (confirm must be true)' }),
  }),
});

export type CloseRfqInput = z.infer<typeof closeRfqSchema>;

export const simulationSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('single_supplier'),
    supplier_id: z.string().uuid('Invalid supplier ID'),
  }),
  z.object({
    mode: z.literal('item_split'),
    items: z.array(
      z.object({
        rfq_item_id: z.string().uuid('Invalid RFQ item ID'),
        supplier_id: z.string().uuid('Invalid supplier ID'),
      }),
    ).min(1, 'At least one item allocation is required'),
  }),
  z.object({
    mode: z.literal('category_split'),
    categories: z.array(
      z.object({
        item_ids: z.array(z.string().uuid('Invalid item ID')).min(1, 'Each category must have at least one item'),
        supplier_id: z.string().uuid('Invalid supplier ID'),
      }),
    ).min(1, 'At least one category is required'),
  }),
]);

export type SimulationInput = z.infer<typeof simulationSchema>;

export const awardSchema = z.object({
  type: z.enum(['single', 'split'], {
    errorMap: () => ({ message: 'Type must be "single" or "split"' }),
  }),
  allocations: z.array(
    z.object({
      supplier_id: z.string().uuid('Invalid supplier ID'),
      item_ids: z.array(z.string().uuid('Invalid item ID')).optional(),
    }),
  ).min(1, 'At least one allocation is required'),
});

export type AwardInput = z.infer<typeof awardSchema>;

export const auditLogQuerySchema = z.object({
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  event_type: z.string().optional(),
  rfq_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;
