import { z } from 'zod';

const bidItemSchema = z.object({
  rfq_item_id: z.string().uuid('rfq_item_id must be a valid UUID'),
  unit_price: z
    .number()
    .positive('Unit price must be a positive number')
    .max(99999999999999.9999, 'Unit price exceeds maximum allowed value'),
});

export const submitBidSchema = z.object({
  items: z.array(bidItemSchema).min(1, 'At least one item is required'),
});

export const reviseBidSchema = z.object({
  items: z.array(bidItemSchema).min(1, 'At least one item is required'),
});

export type SubmitBidInput = z.infer<typeof submitBidSchema>;
export type ReviseBidInput = z.infer<typeof reviseBidSchema>;
