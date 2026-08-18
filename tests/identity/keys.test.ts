import { describe, it, expect } from 'vitest';
import {
  loadPrivateKey,
  loadPublicKey,
  publicKeyFromPrivate,
  toJwks,
} from '../../src/identity/keys.js';
import { generatePemPair } from './key-fixtures.js';

describe.each(['EdDSA', 'RS256'] as const)('key loading (%s)', (alg) => {
  it('loads a private key from a PKCS#8 PEM and stamps alg/kid', async () => {
    const { privatePem } = await generatePemPair(alg);
    const key = await loadPrivateKey(privatePem, { kid: 'k1', alg });
    expect(key.kid).toBe('k1');
    expect(key.alg).toBe(alg);
    expect(key.jwk.alg).toBe(alg);
    expect(key.jwk.kid).toBe('k1');
    expect(key.jwk.d).toBeTruthy();
  });

  it('loads a public key from an SPKI PEM and from JWK JSON', async () => {
    const { privatePem, publicPem } = await generatePemPair(alg);
    const fromPem = await loadPublicKey(publicPem, { kid: 'k1', alg });
    expect(fromPem.jwk.d).toBeUndefined();

    const derived = publicKeyFromPrivate(await loadPrivateKey(privatePem, { kid: 'k1', alg }));
    const fromJson = await loadPublicKey(JSON.stringify(derived.jwk), { kid: 'k1', alg });
    expect(fromJson.jwk).toEqual(derived.jwk);
  });

  it('derives a public key that carries no private component', async () => {
    const { privatePem } = await generatePemPair(alg);
    const priv = await loadPrivateKey(privatePem, { kid: 'k1', alg });
    const pub = publicKeyFromPrivate(priv);
    expect(pub.jwk.d).toBeUndefined();
    expect(pub.kid).toBe('k1');
    expect(JSON.stringify(pub.jwk)).not.toContain(String(priv.jwk.d));
  });

  it('rejects a public key where a private one is required, and vice versa', async () => {
    const { privatePem, publicPem } = await generatePemPair(alg);
    await expect(loadPrivateKey(publicPem, { kid: 'k1', alg })).rejects.toThrow(
      'INVALID_KEY_MATERIAL'
    );
    await expect(loadPublicKey(privatePem, { kid: 'k1', alg })).rejects.toThrow(
      'INVALID_KEY_MATERIAL'
    );
  });

  it('rejects garbage material', async () => {
    await expect(loadPrivateKey('not a key', { kid: 'k1', alg })).rejects.toThrow(
      'INVALID_KEY_MATERIAL'
    );
    await expect(loadPrivateKey('{ nope', { kid: 'k1', alg })).rejects.toThrow(
      'INVALID_KEY_MATERIAL'
    );
  });

  it('rejects material of the other key type', async () => {
    const other = alg === 'RS256' ? 'EdDSA' : 'RS256';
    const { privatePem } = await generatePemPair(other);
    await expect(loadPrivateKey(privatePem, { kid: 'k1', alg })).rejects.toThrow(
      'INVALID_KEY_MATERIAL'
    );
  });
});

describe('toJwks', () => {
  it('builds a JWKS document from public keys', async () => {
    const { privatePem } = await generatePemPair('EdDSA');
    const priv = await loadPrivateKey(privatePem, { kid: 'ed-1', alg: 'EdDSA' });
    const doc = toJwks([publicKeyFromPrivate(priv)]);
    expect(doc.keys).toHaveLength(1);
    expect(doc.keys[0]).toMatchObject({
      kty: 'OKP',
      crv: 'Ed25519',
      alg: 'EdDSA',
      kid: 'ed-1',
      use: 'sig',
    });
    expect(doc.keys[0]!.x).toBeTruthy();
  });

  it('never emits a private component, even when handed a private key', async () => {
    const { privatePem } = await generatePemPair('RS256');
    const priv = await loadPrivateKey(privatePem, { kid: 'rsa-1', alg: 'RS256' });
    const doc = toJwks([priv]);
    const serialized = JSON.stringify(doc);
    expect(doc.keys[0]).toMatchObject({ kty: 'RSA', alg: 'RS256', kid: 'rsa-1', use: 'sig' });
    expect(doc.keys[0]!.d).toBeUndefined();
    for (const member of ['d', 'p', 'q', 'dp', 'dq', 'qi'] as const) {
      expect(serialized).not.toContain(`"${member}":`);
    }
  });

  it('carries several keys, which is what makes rotation possible', async () => {
    const a = await loadPrivateKey((await generatePemPair('EdDSA')).privatePem, {
      kid: 'a',
      alg: 'EdDSA',
    });
    const b = await loadPrivateKey((await generatePemPair('EdDSA')).privatePem, {
      kid: 'b',
      alg: 'EdDSA',
    });
    const doc = toJwks([publicKeyFromPrivate(a), publicKeyFromPrivate(b)]);
    expect(doc.keys.map((k) => k.kid)).toEqual(['a', 'b']);
  });
});
