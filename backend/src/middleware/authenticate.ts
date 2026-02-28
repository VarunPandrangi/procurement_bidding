import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../shared/utils/token';
import { sendError } from '../shared/utils/response';

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 'AUTHENTICATION_REQUIRED', 'Authentication token is required', 401);
    return;
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === 'TokenExpiredError') {
        sendError(res, 'TOKEN_EXPIRED', 'Access token has expired', 401);
        return;
      }
      if (err.name === 'JsonWebTokenError') {
        sendError(res, 'INVALID_TOKEN', 'Invalid or malformed token', 401);
        return;
      }
    }
    sendError(res, 'AUTHENTICATION_REQUIRED', 'Authentication failed', 401);
  }
}
