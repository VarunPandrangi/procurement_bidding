import { z } from 'zod';
import { UserRole } from '../types/enums';

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(1, 'Full name is required').max(255),
  role: z.enum([UserRole.ADMIN, UserRole.BUYER, UserRole.SUPPLIER]),
});

export const updateUserSchema = z
  .object({
    role: z.enum([UserRole.ADMIN, UserRole.BUYER, UserRole.SUPPLIER]).optional(),
    is_active: z.boolean().optional(),
    full_name: z.string().min(1).max(255).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
