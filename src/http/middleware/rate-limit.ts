import type { MiddlewareHandler } from 'hono';

interface RateEntry {
  count: number;
  resetAt: number;
}

function getIp(c: Parameters<MiddlewareHandler>[0]): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('cf-connecting-ip') ??
    'unknown'
  );
}

/**
 * In-memory, per-IP fixed-window rate limiter. Defaults: 10 requests / 15 min.
 * Each call to `rateLimit` gets its own isolated store, so different routes
 * (e.g. `/auth/token`) can have independent budgets.
 */
export function rateLimit(
  options: { windowMs?: number; max?: number } = {}
): MiddlewareHandler {
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const max = options.max ?? 10;
  const store = new Map<string, RateEntry>();

  return async (c, next) => {
    const ip = getIp(c);
    const now = Date.now();

    const entry = store.get(ip);
    if (!entry || entry.resetAt < now) {
      store.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count++;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      c.header('Retry-After', String(retryAfter));
      return c.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' } },
        429
      );
    }

    return next();
  };
}
