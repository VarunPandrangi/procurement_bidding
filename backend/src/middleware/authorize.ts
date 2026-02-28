import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../shared/types/enums';
import { sendError } from '../shared/utils/response';

export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'AUTHENTICATION_REQUIRED', 'Authentication is required', 401);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendError(res, 'FORBIDDEN', 'Insufficient permissions', 403);
      return;
    }

    next();
  };
}
