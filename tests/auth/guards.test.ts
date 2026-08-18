import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { createAuthGuards, type Principal } from '../../src/auth/guards.js';
import { signToken } from '../../src/identity/jwt.js';

const SECRET = 'x'.repeat(32);

function buildApp(resolveApiKey: (raw: string) => Promise<Principal | null>) {
  const guards = createAuthGuards({ jwtSecret: SECRET, keyPrefix: 'kl_', resolveApiKey });
  const app = new Hono();
  app.get('/any', guards.requireAuth, (c) => c.json(c.get('principal')));
  app.get('/jwt-only', guards.requireJwt, (c) => c.json(c.get('principal')));
  app.get('/admin', guards.requireAuth, guards.requireRole('admin'), (c) => c.text('ok'));
  app.get('/grown', guards.requireAuth, guards.requireRole('admin', 'adult'), (c) => c.text('ok'));
  return app;
}

const noKeys = async () => null;

describe('requireAuth', () => {
  it('accepts a valid JWT and exposes the principal', async () => {
    const app = buildApp(noKeys);
    const token = await signToken({ sub: 'u1', role: 'admin' }, SECRET, 3600);
    const res = await app.request('/any', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ type: 'jwt', userId: 'u1', role: 'admin' });
  });

  it('accepts a valid API key via the resolver', async () => {
    const resolve = vi.fn(async (raw: string) =>
      raw === 'kl_secret' ? ({ type: 'api_key', userId: 'u2', role: 'child' } as Principal) : null
    );
    const app = buildApp(resolve);
    const res = await app.request('/any', { headers: { Authorization: 'Bearer kl_secret' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ type: 'api_key', userId: 'u2', role: 'child' });
  });

  it('401s a rejected API key', async () => {
    const app = buildApp(noKeys);
    const res = await app.request('/any', { headers: { Authorization: 'Bearer kl_bad' } });
    expect(res.status).toBe(401);
  });

  it('401s a missing header', async () => {
    const res = await buildApp(noKeys).request('/any');
    expect(res.status).toBe(401);
  });
});

describe('requireJwt', () => {
  it('rejects API-key auth on jwt-only routes', async () => {
    const resolve = async () => ({ type: 'api_key', userId: 'u', role: 'admin' } as Principal);
    const res = await buildApp(resolve).request('/jwt-only', {
      headers: { Authorization: 'Bearer kl_secret' },
    });
    expect(res.status).toBe(401);
  });

  it('accepts a JWT', async () => {
    const token = await signToken({ sub: 'u1', role: 'adult' }, SECRET, 3600);
    const res = await buildApp(noKeys).request('/jwt-only', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });
});

describe('requireRole', () => {
  it('allows an admin through an admin-only route', async () => {
    const token = await signToken({ sub: 'u1', role: 'admin' }, SECRET, 3600);
    const res = await buildApp(noKeys).request('/admin', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });

  it('403s a child on an admin-only route', async () => {
    const token = await signToken({ sub: 'u1', role: 'child' }, SECRET, 3600);
    const res = await buildApp(noKeys).request('/admin', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it('allows any listed role (admin OR adult)', async () => {
    const token = await signToken({ sub: 'u1', role: 'adult' }, SECRET, 3600);
    const res = await buildApp(noKeys).request('/grown', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });
});

describe('guards with an expected issuer/audience', () => {
  function buildScopedApp(deps: { jwtIssuer?: string; jwtAudience?: string }) {
    const guards = createAuthGuards({
      jwtSecret: SECRET,
      keyPrefix: 'kl_',
      resolveApiKey: noKeys,
      ...deps,
    });
    const app = new Hono();
    app.get('/any', guards.requireAuth, (c) => c.json(c.get('principal')));
    return app;
  }

  it('accepts a token minted for this service', async () => {
    const app = buildScopedApp({ jwtIssuer: 'heorth', jwtAudience: 'kithledger' });
    const token = await signToken(
      { sub: 'u1', role: 'admin', iss: 'heorth', aud: 'kithledger' },
      SECRET,
      3600
    );
    const res = await app.request('/any', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ type: 'jwt', userId: 'u1', role: 'admin' });
  });

  it('401s a token minted for another service', async () => {
    const app = buildScopedApp({ jwtIssuer: 'heorth', jwtAudience: 'kithledger' });
    const token = await signToken(
      { sub: 'u1', role: 'admin', iss: 'heorth', aud: 'heorth' },
      SECRET,
      3600
    );
    const res = await app.request('/any', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
  });

  it('accepts a legacy iss/aud-less token when no expectation is configured', async () => {
    const app = buildScopedApp({});
    const token = await signToken({ sub: 'u1', role: 'admin' }, SECRET, 3600);
    const res = await app.request('/any', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
  });
});
