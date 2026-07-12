import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { ok, err } from '../../src/http/response.js';

function makeApp() {
  const app = new Hono();
  app.get('/ok', (c) => ok(c, { hello: 'world' }, { total: 1 }));
  app.get('/created', (c) => ok(c, { id: 1 }, undefined, 201));
  app.get('/err', (c) => err(c, 'NOT_FOUND', 'missing', 404));
  return app;
}

describe('response envelope', () => {
  it('wraps success payloads in { data, meta }', async () => {
    const res = await makeApp().request('/ok');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { hello: 'world' }, meta: { total: 1 } });
  });

  it('defaults meta to {} and supports a 201 status', async () => {
    const res = await makeApp().request('/created');
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ data: { id: 1 }, meta: {} });
  });

  it('wraps failures in { error: { code, message } }', async () => {
    const res = await makeApp().request('/err');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'missing' } });
  });
});
