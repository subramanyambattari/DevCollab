import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import type { ApiErrorResponse } from '../../../shared/types.js';

export function errorMiddleware(error: unknown, _req: Request, res: Response<ApiErrorResponse>, next: NextFunction): void {
  void next;
  if (error instanceof ZodError) {
    res.status(400).json({
      message: 'Validation failed.',
      code: 'VALIDATION_ERROR',
      details: { issues: error.issues }
    });
    return;
  }

  if (error instanceof AppError) {
    const payload: ApiErrorResponse = { message: error.message, code: error.code };
    if (error.details !== undefined) {
      payload.details = error.details;
    }
    res.status(error.statusCode).json(payload);
    return;
  }

  console.error(error);
  res.status(500).json({ message: 'Server error.', code: 'INTERNAL_SERVER_ERROR' });
}
