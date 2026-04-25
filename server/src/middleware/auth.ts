import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/token.js';
import { UserRepository } from '../repositories/user-repository.js';
import { mapPublicUser } from '../lib/mappers.js';

function getBearerToken(header?: string): string | null {
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

export function createAuthMiddleware(users: UserRepository) {
  return async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      const token = getBearerToken(req.header('authorization'));
      if (!token) {
        throw new UnauthorizedError('Missing authorization token.');
      }

      const payload = verifyAccessToken(token);
      const user = await users.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedError('Invalid token.');
      }

      req.user = mapPublicUser(user as Parameters<typeof mapPublicUser>[0]);
      req.auth = { accessToken: token };
      next();
    } catch (error) {
      next(error instanceof UnauthorizedError ? error : new UnauthorizedError('Authentication failed.'));
    }
  };
}
