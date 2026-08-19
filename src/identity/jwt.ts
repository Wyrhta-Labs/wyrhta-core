import { sign, verify, decode } from 'hono/jwt';
import type { Role } from './schema.js';
import type { JwtAlgorithm, PrivateSigningKey, PublicVerificationKey } from './keys.js';

/**
 * Domain error convention (see README § "Domain error codes"): expected,
 * caller-actionable failures in this module are thrown as a bare `Error`
 * whose message is an UPPER_SNAKE_CASE code matching `^[A-Z][A-Z0-9_]{1,63}$`
 * — `INVALID_TOKEN`, `INVALID_ISSUER`, `INVALID_AUDIENCE`, `UNKNOWN_KEY_ID`,
 * `INVALID_ALGORITHM`, `TOKEN_EXPIRED`, `TOKEN_NOT_BEFORE`, `TOKEN_ISSUED_AT`.
 * Callers may match on that shape to decide what is safe to surface; anything
 * else escaping this module is an unexpected failure with no such contract.
 * (The convention was previously implemented by the `./mcp` scaffold, removed
 * in 0.3.0.)
 */

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

/**
 * What `signToken` signs with: a shared secret (HS256, unchanged) or a private
 * key loaded via `loadPrivateKey` (RS256 / EdDSA).
 */
export type SigningKey = string | PrivateSigningKey;

/**
 * What `verifyToken` verifies against: a shared secret (HS256, unchanged), a
 * single public key, or a set of public keys selected by the token's `kid`.
 * A verifier holding public keys is structurally unable to mint.
 */
export type VerificationKey = string | PublicVerificationKey | PublicVerificationKey[];

export interface VerifyTokenOptions extends TokenIdentityOptions {
  /**
   * Expected algorithm. Only meaningful for a string key (default `HS256`);
   * with public keys the algorithm comes from the selected key, and stating a
   * conflicting one throws `INVALID_ALGORITHM`.
   */
  algorithm?: JwtAlgorithm;
  /**
   * Clock-skew tolerance in seconds applied to `exp` / `nbf` / `iat`.
   * Defaults to `0` — byte-for-byte the pre-v0.2.0 behavior. Cross-container
   * verification of short-TTL tokens should pass a small value (e.g. 60).
   */
  leewaySeconds?: number;
}

/**
 * Sign a JWT carrying the user id (`sub`) and `role`.
 *
 * `iss` / `aud` are written **only** when supplied, so tokens keep their
 * historical `{ sub, role, iat, exp }` shape unless a caller opts in.
 *
 * With a string `key` the token is HS256, exactly as before. With a
 * `PrivateSigningKey` it is signed by that key's algorithm and its `kid` is
 * stamped into the JWT header, so a verifier can pick the right public key.
 */
export async function signToken(
  claims: { sub: string; role: Role } & TokenIdentityOptions,
  key: SigningKey,
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
  if (typeof key === 'string') return sign(payload, key);
  // hono's `sign` reads `alg` and `kid` off a JWK-shaped key and writes both
  // into the header — that is how the `kid` gets stamped.
  return sign(payload, key.jwk, key.alg);
}

/** The token header, as far as key selection cares. */
function headerOf(token: string): { alg?: string; kid?: string } {
  try {
    return decode(token).header as { alg?: string; kid?: string };
  } catch {
    throw new Error('INVALID_TOKEN');
  }
}

/** Pick the public key whose `kid` matches the token header. */
function selectKey(token: string, keys: PublicVerificationKey[]): PublicVerificationKey {
  if (keys.length === 0) throw new Error('UNKNOWN_KEY_ID');
  const { kid } = headerOf(token);
  if (kid === undefined) {
    // Only unambiguous with a single configured key.
    if (keys.length === 1) return keys[0]!;
    throw new Error('UNKNOWN_KEY_ID');
  }
  const match = keys.find((k) => k.kid === kid);
  if (!match) throw new Error('UNKNOWN_KEY_ID');
  return match;
}

/**
 * Enforce the time claims with a leeway. Mirrors `hono/jwt`'s own checks —
 * which have no tolerance — widened by `leeway` seconds.
 */
function checkTimeClaims(payload: Record<string, unknown>, leeway: number): void {
  const now = Math.floor(Date.now() / 1000);
  const { nbf, exp, iat } = payload as { nbf?: unknown; exp?: unknown; iat?: unknown };
  if (nbf !== undefined) {
    if (typeof nbf !== 'number' || !Number.isFinite(nbf) || nbf > now + leeway) {
      throw new Error('TOKEN_NOT_BEFORE');
    }
  }
  if (exp !== undefined) {
    if (typeof exp !== 'number' || !Number.isFinite(exp) || exp <= now - leeway) {
      throw new Error('TOKEN_EXPIRED');
    }
  }
  if (iat !== undefined) {
    if (typeof iat !== 'number' || !Number.isFinite(iat) || now + leeway < iat) {
      throw new Error('TOKEN_ISSUED_AT');
    }
  }
}

/**
 * Verify a JWT. `hono/jwt`'s `verify` REQUIRES the algorithm as its 3rd
 * argument — omitting it throws `JwtAlgorithmRequired`. `verify` also throws on
 * an expired token (`JwtTokenExpired`).
 *
 * The second argument accepts a shared secret (HS256, unchanged) or public key
 * material from `./keys`; with a key set, the key is selected by the token
 * header's `kid` and a token signed by any other key fails signature
 * verification.
 *
 * The third argument accepts either the bare algorithm (the original,
 * still-supported form; a string key still defaults to `HS256`) or an options
 * object that may additionally state which `iss` / `aud` the caller expects and
 * how much clock skew to tolerate.
 * Expectations are checked **only when given**: with none passed, a token
 * carrying no `iss`/`aud` — every token minted before this convention existed —
 * verifies exactly as before.
 *
 * Domain errors follow the repo's bare UPPER_SNAKE_CASE convention:
 * `INVALID_TOKEN`, `INVALID_ISSUER`, `INVALID_AUDIENCE`, `INVALID_ALGORITHM`,
 * `UNKNOWN_KEY_ID`, `TOKEN_EXPIRED`, `TOKEN_NOT_BEFORE`, `TOKEN_ISSUED_AT`.
 */
export async function verifyToken(
  token: string,
  key: VerificationKey,
  options: JwtAlgorithm | VerifyTokenOptions = {}
): Promise<TokenClaims> {
  const opts: VerifyTokenOptions = typeof options === 'string' ? { algorithm: options } : options;

  let material: Parameters<typeof verify>[1];
  let algorithm: JwtAlgorithm;
  if (typeof key === 'string') {
    material = key;
    algorithm = opts.algorithm ?? 'HS256';
  } else {
    const selected = selectKey(token, Array.isArray(key) ? key : [key]);
    if (opts.algorithm !== undefined && opts.algorithm !== selected.alg) {
      throw new Error('INVALID_ALGORITHM');
    }
    material = selected.jwk;
    algorithm = selected.alg;
  }

  const leeway = opts.leewaySeconds ?? 0;
  const payload = await verify(
    token,
    material,
    leeway > 0 ? { alg: algorithm, exp: false, nbf: false, iat: false } : algorithm
  );
  if (leeway > 0) checkTimeClaims(payload as Record<string, unknown>, leeway);

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
