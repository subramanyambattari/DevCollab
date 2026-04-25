import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { AppError, UnauthorizedError, ValidationError } from '../lib/errors.js';
import { createTokenPair, hashToken, verifyRefreshToken } from '../lib/token.js';
import { mapPublicUser } from '../lib/mappers.js';
import type { AuthSession, PublicUser } from '../../../shared/types.js';
import { UserRepository } from '../repositories/user-repository.js';

function parseTtlToMs(value: string): number {
  const match = /^(\d+)([smhd])$/i.exec(value);
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000;
  }

  const [, amountText, unitText] = match;
  const amount = Number(amountText);
  const unit = (unitText ?? 'd').toLowerCase();

  switch (unit) {
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60 * 1000;
    case 'h':
      return amount * 60 * 60 * 1000;
    default:
      return amount * 24 * 60 * 60 * 1000;
  }
}

export class AuthService {
  constructor(private readonly users: UserRepository) {}

  private async buildSession(userRecord: Awaited<ReturnType<UserRepository['create']>>): Promise<AuthSession> {
    const user = mapPublicUser(userRecord as Parameters<typeof mapPublicUser>[0]);
    const tokens = createTokenPair(user);
    const nextRefreshToken = tokens.refreshToken;
    if (!nextRefreshToken) {
      throw new AppError('Could not create auth session.', 500, 'SESSION_CREATION_FAILED');
    }

    const refreshTokenHash = hashToken(nextRefreshToken);
    const refreshTokenExpiresAt = new Date(Date.now() + parseTtlToMs(env.REFRESH_TOKEN_TTL));

    await this.users.storeRefreshToken(user.id, refreshTokenHash, refreshTokenExpiresAt);

    return { user, tokens };
  }

  async register(payload: { username: string; password: string }): Promise<AuthSession> {
    const username = payload.username.trim();
    const password = payload.password;

    if (username.length < 3 || password.length < 6) {
      throw new ValidationError('Username must be at least 3 characters and password must be at least 6 characters.');
    }

    const existingUser = await this.users.findByUsername(username);
    if (existingUser) {
      throw new AppError('Username is already taken.', 409, 'USERNAME_TAKEN');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.users.create({ username, passwordHash });

    return this.buildSession(user);
  }

  async login(payload: { username: string; password: string }): Promise<AuthSession> {
    const username = payload.username.trim();
    const password = payload.password;

    const user = await this.users.findByUsername(username);
    if (!user) {
      throw new UnauthorizedError('Invalid username or password.');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid username or password.');
    }

    return this.buildSession(user);
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    let payload: ReturnType<typeof verifyRefreshToken>;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Refresh token is invalid.');
    }

    const user = await this.users.findById(payload.sub);
    if (!user || !user.refreshTokenHash || !user.refreshTokenExpiresAt) {
      throw new UnauthorizedError('Refresh token has expired.');
    }

    if (user.refreshTokenExpiresAt.getTime() < Date.now()) {
      await this.users.clearRefreshToken(payload.sub);
      throw new UnauthorizedError('Refresh token has expired.');
    }

    const hash = hashToken(refreshToken);
    if (hash !== user.refreshTokenHash) {
      throw new UnauthorizedError('Refresh token is invalid.');
    }

    const publicUser: PublicUser = mapPublicUser(user as Parameters<typeof mapPublicUser>[0]);
    const tokens = createTokenPair(publicUser);
    const nextRefreshToken = tokens.refreshToken;
    if (!nextRefreshToken) {
      throw new AppError('Could not create auth session.', 500, 'SESSION_CREATION_FAILED');
    }

    const refreshTokenHash = hashToken(nextRefreshToken);
    const refreshTokenExpiresAt = new Date(Date.now() + parseTtlToMs(env.REFRESH_TOKEN_TTL));

    await this.users.storeRefreshToken(publicUser.id, refreshTokenHash, refreshTokenExpiresAt);

    return { user: publicUser, tokens };
  }

  async revoke(refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      return;
    }

    try {
      const payload = verifyRefreshToken(refreshToken);
      await this.users.clearRefreshToken(payload.sub);
    } catch {
      return;
    }
  }

  async getCurrentUser(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedError('Invalid token.');
    }

    return mapPublicUser(user as Parameters<typeof mapPublicUser>[0]);
  }
}
