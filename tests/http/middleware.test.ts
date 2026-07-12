import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { ZodError, z } from 'zod';
import { requestId } from '../../src/http/middleware/request-id.js';
import { securityHeaders } from '../../src/http/middleware/security-headers.js';
import { rateLimit } from '../../src/http/middleware/rate-limit.js';
import { errorHandler } from '../../src/http/middleware/error-handler.js';

describe('requestId', () => {
  it('echoes an incoming X-Request-Id and exposes it on the context', async () => {
    const app = new Hono();
    app.use('*', requestId);
    app.get('/', (c) => c.text(c.get('requestId')));
    const res = await app.request('/', { headers: { 'x-request-id': 'abc-123' } });
    expect(res.headers.get('X-Request-Id')).toBe('abc-123');
    expect(await res.text()).toBe('abc-123');
  });

  it('generates a request id when none is supplied', async () => {
    const app = new Hono();
    app.use('*', requestId);
    app.get('/', (c) => c.text('ok'));
    const res = await app.request('/');
    expect(res.headers.get('X-Request-Id')).toMatch(/[0-9a-f-]{36}/);
  });
});

describe('securityHeaders', () => {
  it('sets hardening headers', async () => {
    const app = new Hono();
    app.use('*', securityHeaders);
    app.get('/', (c) => c.text('ok'));
    const res = await app.request('/');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('X-XSS-Protection')).toBe('0');
  });
});

describe('rateLimit', () => {
  it('returns 429 after the max is exceeded for an IP', async () => {
    const app = new Hono();
    app.use('*', rateLimit({ windowMs: 60_000, max: 2 }));
    app.get('/', (c) => c.text('ok'));
    const headers = { 'x-forwarded-for': '10.0.0.1' };
    expect((await app.request('/', { headers })).status).toBe(200);
    expect((await app.request('/', { headers })).status).toBe(200);
    const third = await app.request('/', { headers });
    expect(third.status).toBe(429);
    expect(third.headers.get('Retry-After')).not.toBeNull();
  });
});

describe('errorHandler', () => {
  it('maps ZodError to a 400 VALIDATION_ERROR', async () => {
    const app = new Hono();
    app.onError(errorHandler);
    app.get('/', () => {
      z.object({ x: z.number() }).parse({ x: 'nope' });
      return new Response();
    });
    const res = await app.request('/');
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
  });

  it('maps unknown errors to a 500 INTERNAL_ERROR', async () => {
    const app = new Hono();
    app.onError(errorHandler);
    app.get('/', () => {
      throw new Error('boom');
    });
    const res = await app.request('/');
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe('INTERNAL_ERROR');
  });
});
