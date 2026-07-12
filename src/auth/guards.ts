import type { MiddlewareHandler } from 'hono';
import { err } from '../http/response.js';
import { verifyToken } from '../identity/jwt.js';
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
  jwtSecret: string;
  /** App API-key prefix, e.g. `kl_` or `he_`. */
  keyPrefix: string;
  /** App bridge: validate a raw key and resolve its owning user + role. */
  resolveApiKey: (raw: string) => Promise<Principal | null>;
}

export interface AuthGuards {
  requireAuth: MiddlewareHandler;
  requireJwt: MiddlewareHandler;
  requireRole: (...roles: Role[]) => MiddlewareHandler;
}

export function createAuthGuards(deps: AuthGuardDeps): AuthGuards {
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
        const claims = await verifyToken(header!.slice(7).trim(), deps.jwtSecret);
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
      const claims = await verifyToken(header!.slice(7).trim(), deps.jwtSecret);
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
