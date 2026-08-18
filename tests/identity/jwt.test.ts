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

describe('jwt issuer/audience', () => {
  it('round-trips iss and aud and verifies them when expected', async () => {
    const token = await signToken(
      { sub: 'u1', role: 'adult', iss: 'heorth', aud: 'kithledger' },
      SECRET,
      3600
    );
    const claims = await verifyToken(token, SECRET, { iss: 'heorth', aud: 'kithledger' });
    expect(claims.sub).toBe('u1');
    expect(claims.iss).toBe('heorth');
    expect(claims.aud).toBe('kithledger');
  });

  it('omits iss and aud from the payload when not supplied', async () => {
    const token = await signToken({ sub: 'u1', role: 'adult' }, SECRET, 3600);
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8')
    ) as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'role', 'sub']);
  });

  it('rejects a mismatched issuer', async () => {
    const token = await signToken({ sub: 'u1', role: 'adult', iss: 'someone-else' }, SECRET, 3600);
    await expect(verifyToken(token, SECRET, { iss: 'heorth' })).rejects.toThrow('INVALID_ISSUER');
  });

  it('rejects a mismatched audience', async () => {
    const token = await signToken(
      { sub: 'u1', role: 'adult', iss: 'heorth', aud: 'heorth' },
      SECRET,
      3600
    );
    await expect(verifyToken(token, SECRET, { aud: 'kithledger' })).rejects.toThrow(
      'INVALID_AUDIENCE'
    );
  });

  it('rejects a token with no issuer when an issuer is expected', async () => {
    const token = await signToken({ sub: 'u1', role: 'adult' }, SECRET, 3600);
    await expect(verifyToken(token, SECRET, { iss: 'heorth' })).rejects.toThrow('INVALID_ISSUER');
  });

  it('accepts an iss/aud-less token when nothing is expected (backward compatible)', async () => {
    const token = await signToken({ sub: 'u1', role: 'child' }, SECRET, 3600);
    await expect(verifyToken(token, SECRET)).resolves.toMatchObject({ sub: 'u1', role: 'child' });
    await expect(verifyToken(token, SECRET, 'HS256')).resolves.toMatchObject({ sub: 'u1' });
    await expect(verifyToken(token, SECRET, {})).resolves.toMatchObject({ sub: 'u1' });
  });

  it('ignores iss/aud carried by a token when the caller expects neither', async () => {
    const token = await signToken(
      { sub: 'u1', role: 'adult', iss: 'heorth', aud: 'kithledger' },
      SECRET,
      3600
    );
    await expect(verifyToken(token, SECRET)).resolves.toMatchObject({ sub: 'u1' });
  });
});
