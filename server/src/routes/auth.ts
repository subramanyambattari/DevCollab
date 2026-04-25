import { Router, type Response } from 'express';
import type { AuthSession } from '../../../shared/types.js';
import { authCredentialsSchema } from '../validation/schemas.js';
import { asyncHandler } from '../lib/async-handler.js';
import { getRefreshCookieOptions } from '../lib/cookies.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { AuthService } from '../services/auth-service.js';
import { UserRepository } from '../repositories/user-repository.js';

interface AuthRouterDeps {
  authService: AuthService;
  users: UserRepository;
}

function sendSession(res: Response, session: AuthSession): void {
  if (session.tokens.refreshToken) {
    res.cookie('refreshToken', session.tokens.refreshToken, getRefreshCookieOptions());
  }
  res.json({
    user: session.user,
    token: session.tokens.accessToken
  });
}

export function createAuthRouter({ authService, users }: AuthRouterDeps) {
  const router = Router();
  const requireAuth = createAuthMiddleware(users);

  router.post(
    '/register',
    asyncHandler(async (req, res) => {
      const dto = authCredentialsSchema.parse(req.body);
      const session = await authService.register(dto);
      sendSession(res, session);
    })
  );

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const dto = authCredentialsSchema.parse(req.body);
      const session = await authService.login(dto);
      sendSession(res, session);
    })
  );

  router.post(
    '/refresh',
    asyncHandler(async (req, res) => {
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token is required.' });
      }

      const session = await authService.refresh(refreshToken);
      sendSession(res, session);
    })
  );

  router.post(
    '/logout',
    asyncHandler(async (req, res) => {
      await authService.revoke(req.cookies?.refreshToken);
      res.clearCookie('refreshToken', getRefreshCookieOptions());
      res.json({ ok: true });
    })
  );

  router.get(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Invalid token.' });
      }

      res.json({ user });
    })
  );

  return router;
}
