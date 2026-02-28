import { z } from 'zod';

// Shared item schema
const rfqItemSchema = z.object({
  sl_no: z.number().int().positive('Serial number must be a positive integer'),
  description: z.string().min(1, 'Description is required').max(1000),
  specification: z.string().max(2000).nullable().optional(),
  uom: z.string().min(1, 'Unit of measure is required').max(50),
  quantity: z.number().positive('Quantity must be positive'),
  last_price: z.number().positive('Last price must be positive').nullable().optional(),
});

// Create RFQ
export const createRfqSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  items: z.array(rfqItemSchema).optional(),
  // Bidding rules (all optional with server defaults)
  max_revisions: z.number().int().min(1).max(20).optional(),
  min_change_percent: z.number().min(0.01).max(100).optional(),
  cooling_time_minutes: z.number().int().min(0).max(1440).optional(),
  bid_open_at: z.string().datetime().nullable().optional(),
  bid_close_at: z.string().datetime().nullable().optional(),
  anti_snipe_window_minutes: z.number().int().min(0).max(120).optional(),
  anti_snipe_extension_minutes: z.number().int().min(0).max(60).optional(),
  // Commercial terms
  payment_terms: z.string().max(2000).nullable().optional(),
  freight_terms: z.string().max(2000).nullable().optional(),
  delivery_lead_time_days: z.number().int().min(1).max(365).nullable().optional(),
  taxes_duties: z.string().max(2000).nullable().optional(),
  warranty: z.string().max(2000).nullable().optional(),
  offer_validity_days: z.number().int().min(1).max(365).nullable().optional(),
  packing_forwarding: z.string().max(2000).nullable().optional(),
  special_conditions: z.string().max(5000).nullable().optional(),
  // Weights
  weight_price: z.number().min(0).max(100).optional(),
  weight_delivery: z.number().min(0).max(100).optional(),
  weight_payment: z.number().min(0).max(100).optional(),
});

// Update RFQ (same fields, all optional, at least one required)
export const updateRfqSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    items: z.array(rfqItemSchema).optional(),
    max_revisions: z.number().int().min(1).max(20).optional(),
    min_change_percent: z.number().min(0.01).max(100).optional(),
    cooling_time_minutes: z.number().int().min(0).max(1440).optional(),
    bid_open_at: z.string().datetime().nullable().optional(),
    bid_close_at: z.string().datetime().nullable().optional(),
    anti_snipe_window_minutes: z.number().int().min(0).max(120).optional(),
    anti_snipe_extension_minutes: z.number().int().min(0).max(60).optional(),
    payment_terms: z.string().max(2000).nullable().optional(),
    freight_terms: z.string().max(2000).nullable().optional(),
    delivery_lead_time_days: z.number().int().min(1).max(365).nullable().optional(),
    taxes_duties: z.string().max(2000).nullable().optional(),
    warranty: z.string().max(2000).nullable().optional(),
    offer_validity_days: z.number().int().min(1).max(365).nullable().optional(),
    packing_forwarding: z.string().max(2000).nullable().optional(),
    special_conditions: z.string().max(5000).nullable().optional(),
    weight_price: z.number().min(0).max(100).optional(),
    weight_delivery: z.number().min(0).max(100).optional(),
    weight_payment: z.number().min(0).max(100).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

// Assign suppliers to RFQ
export const assignSuppliersSchema = z.object({
  supplier_ids: z
    .array(z.string().uuid('Each supplier_id must be a valid UUID'))
    .min(2, 'At least 2 suppliers are required'),
});

// Supplier accept RFQ — all three declarations must be exactly true
export const acceptRfqSchema = z.object({
  declaration_rfq_terms: z.literal(true, {
    errorMap: () => ({ message: 'RFQ terms declaration must be accepted (true)' }),
  }),
  declaration_no_collusion: z.literal(true, {
    errorMap: () => ({ message: 'No collusion declaration must be accepted (true)' }),
  }),
  declaration_confidentiality: z.literal(true, {
    errorMap: () => ({ message: 'Confidentiality declaration must be accepted (true)' }),
  }),
});

// Supplier decline RFQ — reason required, minimum 20 characters
export const declineRfqSchema = z.object({
  reason: z
    .string()
    .min(20, 'Decline reason must be at least 20 characters')
    .max(2000, 'Decline reason must not exceed 2000 characters'),
});

// Exported inferred types
export type CreateRfqInput = z.infer<typeof createRfqSchema>;
export type UpdateRfqInput = z.infer<typeof updateRfqSchema>;
export type AssignSuppliersInput = z.infer<typeof assignSuppliersSchema>;
export type AcceptRfqInput = z.infer<typeof acceptRfqSchema>;
export type DeclineRfqInput = z.infer<typeof declineRfqSchema>;
