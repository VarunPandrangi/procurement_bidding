import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../shared/utils/response';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const zodError = result.error as ZodError;
      const details = zodError.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      sendError(res, 'VALIDATION_ERROR', 'Request validation failed', 422, details);
      return;
    }

    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const zodError = result.error as ZodError;
      const details = zodError.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      sendError(res, 'VALIDATION_ERROR', 'Request validation failed', 422, details);
      return;
    }

    req.query = result.data;
    next();
  };
}
