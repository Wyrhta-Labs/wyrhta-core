import { sign, verify } from 'hono/jwt';
import type { Role } from './schema.js';

export interface TokenClaims {
  sub: string;
  role: Role;
  /** Issuing service, e.g. `heorth`. Absent on tokens minted before v0.2.0. */
  iss?: string;
  /** Intended audience service, e.g. `kithledger`. Absent on older tokens. */
  aud?: string;
  iat?: number;
  exp?: number;
}

/** Optional issuer/audience convention carried by a token. */
export interface TokenIdentityOptions {
  /** Value to put in / expect for the `iss` claim. */
  iss?: string;
  /** Value to put in / expect for the `aud` claim. */
  aud?: string;
}

export interface VerifyTokenOptions extends TokenIdentityOptions {
  algorithm?: 'HS256';
}

/**
 * Sign an HS256 JWT carrying the user id (`sub`) and `role`.
 *
 * `iss` / `aud` are written **only** when supplied, so tokens keep their
 * historical `{ sub, role, iat, exp }` shape unless a caller opts in.
 */
export async function signToken(
  claims: { sub: string; role: Role } & TokenIdentityOptions,
  secret: string,
  ttlSeconds: number
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    sub: claims.sub,
    role: claims.role,
    iat: now,
    exp: now + ttlSeconds,
  };
  if (claims.iss !== undefined) payload.iss = claims.iss;
  if (claims.aud !== undefined) payload.aud = claims.aud;
  return sign(payload, secret);
}

/**
 * Verify an HS256 JWT. `hono/jwt`'s `verify` REQUIRES the algorithm as its 3rd
 * argument — omitting it throws `JwtAlgorithmRequired`. `verify` also throws on
 * an expired token (`JwtTokenExpired`).
 *
 * The third argument accepts either the bare algorithm (the original,
 * still-supported form) or an options object that may additionally state which
 * `iss` / `aud` the caller expects. Expectations are checked **only when
 * given**: with none passed, a token carrying no `iss`/`aud` — every token
 * minted before this convention existed — verifies exactly as before.
 *
 * Domain errors follow the repo's bare UPPER_SNAKE_CASE convention:
 * `INVALID_TOKEN`, `INVALID_ISSUER`, `INVALID_AUDIENCE`.
 */
export async function verifyToken(
  token: string,
  secret: string,
  options: 'HS256' | VerifyTokenOptions = 'HS256'
): Promise<TokenClaims> {
  const opts: VerifyTokenOptions = typeof options === 'string' ? { algorithm: options } : options;
  const payload = await verify(token, secret, opts.algorithm ?? 'HS256');
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('INVALID_TOKEN');
  }
  if (opts.iss !== undefined && payload.iss !== opts.iss) {
    throw new Error('INVALID_ISSUER');
  }
  if (opts.aud !== undefined && payload.aud !== opts.aud) {
    throw new Error('INVALID_AUDIENCE');
  }
  return payload as unknown as TokenClaims;
}
