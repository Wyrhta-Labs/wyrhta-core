import { describe, it, expect } from 'vitest';
import { generateApiKey, hashKey } from '../../src/lib/crypto.js';

describe('generateApiKey', () => {
  it('produces a raw key that starts with the configured prefix', () => {
    const { raw } = generateApiKey({ prefix: 'kl_' });
    expect(raw.startsWith('kl_')).toBe(true);
  });

  it('produces 64 hex chars of entropy after the prefix', () => {
    const { raw } = generateApiKey({ prefix: 'he_' });
    const body = raw.slice('he_'.length);
    expect(body).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns a display prefix of prefix + 8 chars', () => {
    const { raw, prefix } = generateApiKey({ prefix: 'kl_' });
    expect(prefix).toBe(raw.slice(0, 'kl_'.length + 8));
    expect(prefix.length).toBe(11);
  });

  it('stores the SHA-256 hash of the raw key, not the raw key', () => {
    const { raw, hash } = generateApiKey({ prefix: 'kl_' });
    expect(hash).toBe(hashKey(raw));
    expect(hash).not.toBe(raw);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates unique keys on each call', () => {
    const a = generateApiKey({ prefix: 'kl_' });
    const b = generateApiKey({ prefix: 'kl_' });
    expect(a.raw).not.toBe(b.raw);
  });
});

describe('hashKey', () => {
  it('is deterministic for the same input', () => {
    expect(hashKey('kl_abc')).toBe(hashKey('kl_abc'));
  });
});
