import type { MiddlewareHandler } from 'hono';
import { err } from '../http/response.js';
import { verifyToken, type VerificationKey, type VerifyTokenOptions } from '../identity/jwt.js';
import type { PublicVerificationKey } from '../identity/keys.js';
import type { Role } from '../identity/schema.js';
import { detectAuthScheme } from './dispatch.js';

export interface Principal {
  type: 'api_key' | 'jwt';
  userId: string;
  role: Role;
}

declare module 'hono' {
  interface ContextVariableMap {
    principal?: Principal;
  }
}

export interface AuthGuardDeps {
  /**
   * HS256 shared secret. Optional only so a satellite that verifies member
   * tokens with `jwtVerificationKeys` need not hold a signing secret at all;
   * one of the two must be given.
   */
  jwtSecret?: string;
  /**
   * Public keys (from `loadPublicKey` / a fetched JWKS) used to verify
   * asymmetrically signed tokens, selected by the token's `kid`. When set,
   * these are used instead of `jwtSecret` — such a guard cannot mint tokens.
   */
  jwtVerificationKeys?: PublicVerificationKey[];
  /**
   * Clock-skew tolerance in seconds for `exp` / `nbf` / `iat`. Defaults to
   * `0` (the pre-v0.2.0 behavior).
   */
  jwtLeewaySeconds?: number;
  /** App API-key prefix, e.g. `kl_` or `he_`. */
  keyPrefix: string;
  /**
   * Expected JWT `iss` claim. When set, a token whose `iss` differs (or is
   * absent) is rejected. Omit to accept any issuer — the pre-v0.2.0 behavior.
   */
  jwtIssuer?: string;
  /**
   * Expected JWT `aud` claim, i.e. this service's own audience name. When set,
   * a token minted for another service is rejected. Omit to accept any
   * audience — the pre-v0.2.0 behavior.
   */
  jwtAudience?: string;
  /** App bridge: validate a raw key and resolve its owning user + role. */
  resolveApiKey: (raw: string) => Promise<Principal | null>;
}

export interface AuthGuards {
  requireAuth: MiddlewareHandler;
  requireJwt: MiddlewareHandler;
  requireRole: (...roles: Role[]) => MiddlewareHandler;
}

export function createAuthGuards(deps: AuthGuardDeps): AuthGuards {
  const verifyOptions: VerifyTokenOptions = {
    iss: deps.jwtIssuer,
    aud: deps.jwtAudience,
    leewaySeconds: deps.jwtLeewaySeconds,
  };
  const verificationKey: VerificationKey = deps.jwtVerificationKeys?.length
    ? deps.jwtVerificationKeys
    : (deps.jwtSecret ?? '');
  if (typeof verificationKey === 'string' && verificationKey === '') {
    throw new Error('MISSING_JWT_VERIFICATION_KEY');
  }

  const requireAuth: MiddlewareHandler = async (c, next) => {
    const header = c.req.header('Authorization');
    const scheme = detectAuthScheme(header, deps.keyPrefix);

    if (scheme === 'api_key') {
      const principal = await deps.resolveApiKey(header!.slice(7).trim());
      if (!principal) return err(c, 'UNAUTHORIZED', 'Invalid API key', 401);
      c.set('principal', principal);
      return next();
    }

    if (scheme === 'jwt') {
      try {
        const claims = await verifyToken(header!.slice(7).trim(), verificationKey, verifyOptions);
        c.set('principal', { type: 'jwt', userId: claims.sub, role: claims.role });
        return next();
      } catch {
        return err(c, 'UNAUTHORIZED', 'Invalid token', 401);
      }
    }

    return err(c, 'UNAUTHORIZED', 'Authentication required', 401);
  };

  const requireJwt: MiddlewareHandler = async (c, next) => {
    const header = c.req.header('Authorization');
    if (detectAuthScheme(header, deps.keyPrefix) !== 'jwt') {
      return err(c, 'UNAUTHORIZED', 'JWT authentication required', 401);
    }
    try {
      const claims = await verifyToken(header!.slice(7).trim(), verificationKey, verifyOptions);
      c.set('principal', { type: 'jwt', userId: claims.sub, role: claims.role });
      return next();
    } catch {
      return err(c, 'UNAUTHORIZED', 'Invalid token', 401);
    }
  };

  const requireRole =
    (...roles: Role[]): MiddlewareHandler =>
    async (c, next) => {
      const principal = c.get('principal');
      if (!principal) return err(c, 'UNAUTHORIZED', 'Authentication required', 401);
      if (!roles.includes(principal.role)) {
        return err(c, 'FORBIDDEN', 'Insufficient role', 403);
      }
      return next();
    };

  return { requireAuth, requireJwt, requireRole };
}
