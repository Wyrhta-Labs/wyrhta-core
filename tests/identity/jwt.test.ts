import { describe, it, expect } from 'vitest';
import { sign } from 'hono/jwt';
import { signToken, verifyToken } from '../../src/identity/jwt.js';
import { loadPrivateKey, publicKeyFromPrivate } from '../../src/identity/keys.js';
import { generatePemPair } from './key-fixtures.js';

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

describe('jwt asymmetric signing', () => {
  it.each(['EdDSA', 'RS256'] as const)('round-trips a %s token via a public key', async (alg) => {
    const { privatePem } = await generatePemPair(alg);
    const priv = await loadPrivateKey(privatePem, { kid: 'k1', alg });
    const token = await signToken({ sub: 'u1', role: 'adult', iss: 'heorth' }, priv, 300);
    const claims = await verifyToken(token, publicKeyFromPrivate(priv), { iss: 'heorth' });
    expect(claims.sub).toBe('u1');
    expect(claims.role).toBe('adult');
  });

  it('stamps the kid into the JWT header', async () => {
    const { privatePem } = await generatePemPair('EdDSA');
    const priv = await loadPrivateKey(privatePem, { kid: 'heorth-2026-08', alg: 'EdDSA' });
    const token = await signToken({ sub: 'u1', role: 'adult' }, priv, 300);
    const header = JSON.parse(Buffer.from(token.split('.')[0]!, 'base64url').toString('utf8'));
    expect(header).toMatchObject({ alg: 'EdDSA', typ: 'JWT', kid: 'heorth-2026-08' });
  });

  it('selects the verification key by kid out of a key set', async () => {
    const a = await loadPrivateKey((await generatePemPair('EdDSA')).privatePem, {
      kid: 'a',
      alg: 'EdDSA',
    });
    const b = await loadPrivateKey((await generatePemPair('EdDSA')).privatePem, {
      kid: 'b',
      alg: 'EdDSA',
    });
    const keySet = [publicKeyFromPrivate(a), publicKeyFromPrivate(b)];
    await expect(
      verifyToken(await signToken({ sub: 'from-a', role: 'adult' }, a, 300), keySet)
    ).resolves.toMatchObject({ sub: 'from-a' });
    await expect(
      verifyToken(await signToken({ sub: 'from-b', role: 'adult' }, b, 300), keySet)
    ).resolves.toMatchObject({ sub: 'from-b' });
  });

  it('rejects a token signed by the wrong key, even under a known kid', async () => {
    const real = await loadPrivateKey((await generatePemPair('EdDSA')).privatePem, {
      kid: 'k1',
      alg: 'EdDSA',
    });
    const impostor = await loadPrivateKey((await generatePemPair('EdDSA')).privatePem, {
      kid: 'k1', // same kid, different key material
      alg: 'EdDSA',
    });
    const forged = await signToken({ sub: 'attacker', role: 'admin' }, impostor, 300);
    await expect(verifyToken(forged, publicKeyFromPrivate(real))).rejects.toThrow();
  });

  it('rejects a token whose kid matches no configured key', async () => {
    const priv = await loadPrivateKey((await generatePemPair('EdDSA')).privatePem, {
      kid: 'other',
      alg: 'EdDSA',
    });
    const known = await loadPrivateKey((await generatePemPair('EdDSA')).privatePem, {
      kid: 'known',
      alg: 'EdDSA',
    });
    const token = await signToken({ sub: 'u1', role: 'adult' }, priv, 300);
    await expect(verifyToken(token, [publicKeyFromPrivate(known)])).rejects.toThrow(
      'UNKNOWN_KEY_ID'
    );
  });

  it('does not let an HS256 token pass against a public key set', async () => {
    const priv = await loadPrivateKey((await generatePemPair('EdDSA')).privatePem, {
      kid: 'k1',
      alg: 'EdDSA',
    });
    const hsToken = await signToken({ sub: 'u1', role: 'admin' }, SECRET, 300);
    await expect(verifyToken(hsToken, [publicKeyFromPrivate(priv)])).rejects.toThrow();
  });

  it('rejects an expectation that conflicts with the key algorithm', async () => {
    const priv = await loadPrivateKey((await generatePemPair('EdDSA')).privatePem, {
      kid: 'k1',
      alg: 'EdDSA',
    });
    const token = await signToken({ sub: 'u1', role: 'adult' }, priv, 300);
    await expect(
      verifyToken(token, publicKeyFromPrivate(priv), { algorithm: 'HS256' })
    ).rejects.toThrow('INVALID_ALGORITHM');
  });

  it('keeps HS256 working unchanged alongside the asymmetric path', async () => {
    const token = await signToken({ sub: 'u1', role: 'child' }, SECRET, 3600);
    const header = JSON.parse(Buffer.from(token.split('.')[0]!, 'base64url').toString('utf8'));
    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
    await expect(verifyToken(token, SECRET)).resolves.toMatchObject({ sub: 'u1', role: 'child' });
  });
});

describe('jwt clock-skew leeway', () => {
  it('rejects a just-expired token with the default (no) leeway', async () => {
    const token = await signToken({ sub: 'u1', role: 'adult' }, SECRET, -10);
    await expect(verifyToken(token, SECRET)).rejects.toThrow();
    await expect(verifyToken(token, SECRET, { leewaySeconds: 0 })).rejects.toThrow();
  });

  it('accepts a token just past exp when a leeway covers the skew', async () => {
    const token = await signToken({ sub: 'u1', role: 'adult' }, SECRET, -10);
    await expect(verifyToken(token, SECRET, { leewaySeconds: 60 })).resolves.toMatchObject({
      sub: 'u1',
    });
  });

  it('still rejects a token well past exp', async () => {
    const token = await signToken({ sub: 'u1', role: 'adult' }, SECRET, -3600);
    await expect(verifyToken(token, SECRET, { leewaySeconds: 60 })).rejects.toThrow(
      'TOKEN_EXPIRED'
    );
  });

  it('tolerates an iat slightly in the future (issuer clock ahead)', async () => {
    const now = Math.floor(Date.now() / 1000);
    const future = await sign({ sub: 'u1', role: 'adult', iat: now + 20, exp: now + 300 }, SECRET);
    await expect(verifyToken(future, SECRET)).rejects.toThrow();
    await expect(verifyToken(future, SECRET, { leewaySeconds: 60 })).resolves.toMatchObject({
      sub: 'u1',
    });
  });

  it('applies leeway on the asymmetric path too', async () => {
    const priv = await loadPrivateKey((await generatePemPair('EdDSA')).privatePem, {
      kid: 'k1',
      alg: 'EdDSA',
    });
    const token = await signToken({ sub: 'u1', role: 'adult' }, priv, -10);
    const pub = publicKeyFromPrivate(priv);
    await expect(verifyToken(token, pub)).rejects.toThrow();
    await expect(verifyToken(token, pub, { leewaySeconds: 60 })).resolves.toMatchObject({
      sub: 'u1',
    });
  });
});
