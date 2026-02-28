import { z } from 'zod'

const rfqItemSchema = z.object({
  sl_no: z.number().int().positive(),
  description: z.string().min(1, 'Description is required').max(1000),
  specification: z.string().max(2000).optional().or(z.literal('')),
  uom: z.string().min(1, 'UOM is required').max(50),
  quantity: z.number().positive('Quantity must be positive'),
  last_price: z.number().positive().optional().nullable(),
})

export const rfqFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  items: z.array(rfqItemSchema).min(1, 'At least one item is required'),
  // Commercial terms
  payment_terms: z.string().max(2000).optional().or(z.literal('')),
  freight_terms: z.string().max(2000).optional().or(z.literal('')),
  delivery_lead_time_days: z.number().int().min(1).max(365).optional().nullable(),
  taxes_duties: z.string().max(2000).optional().or(z.literal('')),
  warranty: z.string().max(2000).optional().or(z.literal('')),
  offer_validity_days: z.number().int().min(1).max(365).optional().nullable(),
  packing_forwarding: z.string().max(2000).optional().or(z.literal('')),
  special_conditions: z.string().max(5000).optional().or(z.literal('')),
  // Bidding rules
  max_revisions: z.number().int().min(1).max(20).optional(),
  min_change_percent: z.number().min(0.01).max(100).optional(),
  cooling_time_minutes: z.number().int().min(0).max(1440).optional(),
  bid_open_at: z.string().optional().or(z.literal('')),
  bid_close_at: z.string().optional().or(z.literal('')),
  anti_snipe_window_minutes: z.number().int().min(0).max(120).optional(),
  anti_snipe_extension_minutes: z.number().int().min(0).max(60).optional(),
  // Weights
  weight_price: z.number().min(0).max(100).optional(),
  weight_delivery: z.number().min(0).max(100).optional(),
  weight_payment: z.number().min(0).max(100).optional(),
})

export type RfqFormData = z.infer<typeof rfqFormSchema> & {
  supplier_ids: string[]
}

export const defaultFormData: RfqFormData = {
  title: '',
  items: [{ sl_no: 1, description: '', specification: '', uom: '', quantity: 1, last_price: null }],
  payment_terms: '',
  freight_terms: '',
  delivery_lead_time_days: null,
  taxes_duties: '',
  warranty: '',
  offer_validity_days: null,
  packing_forwarding: '',
  special_conditions: '',
  max_revisions: 5,
  min_change_percent: 1,
  cooling_time_minutes: 15,
  bid_open_at: '',
  bid_close_at: '',
  anti_snipe_window_minutes: 5,
  anti_snipe_extension_minutes: 3,
  weight_price: 100,
  weight_delivery: 0,
  weight_payment: 0,
  supplier_ids: [],
}
