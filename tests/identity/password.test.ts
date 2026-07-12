import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/identity/password.js';

describe('password hashing', () => {
  it('produces an argon2id hash that verifies against the original', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(hash, 'correct horse battery staple')).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('s3cret');
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
  });

  it('returns false (does not throw) on a malformed hash', async () => {
    expect(await verifyPassword('not-a-hash', 'whatever')).toBe(false);
  });

  it('salts — two hashes of the same password differ', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).not.toBe(b);
  });
});
