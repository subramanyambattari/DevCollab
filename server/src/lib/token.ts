import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';
import type { PublicUser, AuthTokens } from '../../../shared/types.js';

export interface AccessTokenPayload {
  sub: string;
  username: string;
  role: string;
}

export interface RefreshTokenPayload {
  sub: string;
  tokenId: string;
}

function signToken(payload: AccessTokenPayload | RefreshTokenPayload, ttl: string): string {
  const options: jwt.SignOptions = {};
  const expiresIn = ttl as jwt.SignOptions['expiresIn'];

  if (expiresIn !== undefined) {
    options.expiresIn = expiresIn;
  }

  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function createAccessToken(user: PublicUser): string {
  const payload: AccessTokenPayload = {
    sub: user.id,
    username: user.username,
    role: user.role
  };

  return signToken(payload, env.ACCESS_TOKEN_TTL);
}

export function createRefreshToken(userId: string): string {
  return signToken(
    {
      sub: userId,
      tokenId: crypto.randomUUID()
    },
    env.REFRESH_TOKEN_TTL
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as RefreshTokenPayload;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createTokenPair(user: PublicUser): AuthTokens {
  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user.id);

  return {
    accessToken,
    refreshToken
  };
}
