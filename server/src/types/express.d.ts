import type { PublicUser } from '../../../shared/types';

declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
      auth?: {
        accessToken: string;
        refreshToken?: string;
      };
    }
  }
}

export {};
