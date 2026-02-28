import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { sendError } from '../shared/utils/response';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
  });

  if (err instanceof AppError) {
    sendError(res, err.code, err.message, err.statusCode, err.details);
    return;
  }

  if (err.name === 'JsonWebTokenError') {
    sendError(res, 'INVALID_TOKEN', 'Invalid or malformed token', 401);
    return;
  }

  if (err.name === 'TokenExpiredError') {
    sendError(res, 'TOKEN_EXPIRED', 'Token has expired', 401);
    return;
  }

  if (err.name === 'SyntaxError' && 'body' in err) {
    sendError(res, 'INVALID_JSON', 'Invalid JSON in request body', 400);
    return;
  }

  sendError(res, 'INTERNAL_ERROR', 'An unexpected error occurred', 500);
}
