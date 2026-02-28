import { z } from 'zod';

export const overrideSchema = z.object({
  entity_type: z.string().min(1, 'Entity type is required'),
  entity_id: z.string().uuid('Invalid entity ID'),
  action: z.string().min(1, 'Action is required'),
  justification: z.string().min(1, 'Justification is required'),
});

export type OverrideInput = z.infer<typeof overrideSchema>;

export const updateConfigSchema = z.object({
  value: z.string().min(1, 'Value is required'),
});

export type UpdateConfigInput = z.infer<typeof updateConfigSchema>;

export const extendRfqSchema = z.object({
  minutes: z.number().int().positive('Minutes must be a positive integer'),
  justification: z.string().min(1, 'Justification is required'),
});

export type ExtendRfqInput = z.infer<typeof extendRfqSchema>;
