import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError } from '../lib/errors.js';
import { UserRole } from '../../../shared/types.js';

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new ForbiddenError('You do not have permission to access this resource.'));
      return;
    }

    next();
  };
}
