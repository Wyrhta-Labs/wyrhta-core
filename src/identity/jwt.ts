import { sign, verify } from 'hono/jwt';
import type { Role } from './schema.js';

export interface TokenClaims {
  sub: string;
  role: Role;
  iat?: number;
  exp?: number;
}

/** Sign an HS256 JWT carrying the user id (`sub`) and `role`. */
export async function signToken(
  claims: { sub: string; role: Role },
  secret: string,
  ttlSeconds: number
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: claims.sub, role: claims.role, iat: now, exp: now + ttlSeconds };
  return sign(payload, secret);
}

/**
 * Verify an HS256 JWT. `hono/jwt`'s `verify` REQUIRES the algorithm as its 3rd
 * argument — omitting it throws `JwtAlgorithmRequired`. `verify` also throws on
 * an expired token (`JwtTokenExpired`).
 */
export async function verifyToken(
  token: string,
  secret: string,
  algorithm: 'HS256' = 'HS256'
): Promise<TokenClaims> {
  const payload = await verify(token, secret, algorithm);
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('INVALID_TOKEN');
  }
  return payload as unknown as TokenClaims;
}
