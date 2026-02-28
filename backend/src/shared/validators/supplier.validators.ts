import { z } from 'zod';

export const onboardSupplierSchema = z.object({
  company_name: z.string().min(1, 'Company name is required').max(255),
  contact_name: z.string().max(255).optional(),
  contact_email: z.string().email('Invalid contact email').optional(),
  email: z.string().email('Invalid login email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(1, 'Full name is required').max(255),
  category_tags: z.array(z.string()).optional(),
});

export type OnboardSupplierInput = z.infer<typeof onboardSupplierSchema>;
