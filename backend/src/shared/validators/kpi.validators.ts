import { z } from 'zod';

// ── Weight configuration ──

export const updateWeightsSchema = z
  .object({
    weight_price: z.number().min(0).max(100),
    weight_delivery: z.number().min(0).max(100),
    weight_payment: z.number().min(0).max(100),
  })
  .refine(
    (data) => data.weight_price + data.weight_delivery + data.weight_payment === 100,
    {
      message: 'Weights must sum to 100',
      path: [],
    },
  );

export type UpdateWeightsInput = z.infer<typeof updateWeightsSchema>;

// ── KPI query parameters ──

export const kpiQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export type KpiQueryInput = z.infer<typeof kpiQuerySchema>;
