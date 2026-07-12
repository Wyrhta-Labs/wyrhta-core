import { describe, it, expect, vi } from 'vitest';
import { generateKey, validateApiKey, hashKey } from '../../src/identity/api-key.js';

describe('generateKey', () => {
  it('delegates to crypto with the configured prefix', () => {
    const { raw, hash, prefix } = generateKey('he_');
    expect(raw.startsWith('he_')).toBe(true);
    expect(hash).toBe(hashKey(raw));
    expect(prefix.length).toBe('he_'.length + 8);
  });
});

describe('validateApiKey', () => {
  it('looks up by the SHA-256 hash of the raw key and returns the record', async () => {
    const record = { keyHash: '', userId: 'u1' };
    const { raw, hash } = generateKey('kl_');
    record.keyHash = hash;
    const lookup = vi.fn(async (h: string) => (h === hash ? record : null));
    const found = await validateApiKey(raw, lookup);
    expect(lookup).toHaveBeenCalledWith(hash);
    expect(found).toBe(record);
  });

  it('returns null when the lookup finds nothing', async () => {
    const found = await validateApiKey('kl_deadbeef', async () => null);
    expect(found).toBeNull();
  });
});
