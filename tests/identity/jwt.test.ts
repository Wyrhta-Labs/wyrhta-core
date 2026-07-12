import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from '../../src/identity/jwt.js';

const SECRET = 'x'.repeat(32);

describe('jwt', () => {
  it('round-trips sub and role through sign/verify', async () => {
    const token = await signToken({ sub: 'user-1', role: 'admin' }, SECRET, 3600);
    const claims = await verifyToken(token, SECRET);
    expect(claims.sub).toBe('user-1');
    expect(claims.role).toBe('admin');
    expect(typeof claims.exp).toBe('number');
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signToken({ sub: 'u', role: 'adult' }, SECRET, 3600);
    await expect(verifyToken(token, 'y'.repeat(32))).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const token = await signToken({ sub: 'u', role: 'adult' }, SECRET, -1);
    await expect(verifyToken(token, SECRET)).rejects.toThrow();
  });
});
