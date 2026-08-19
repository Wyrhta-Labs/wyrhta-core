import { describe, it, expect } from 'vitest';
import { DrizzleQueryError } from 'drizzle-orm';
import {
  isUniqueViolation,
  issueToken,
  createUser,
  type CreateUserInput,
} from '../../src/identity/service.js';
import { verifyToken } from '../../src/identity/jwt.js';
import type { CoreDb } from '../../src/db/client.js';

const SECRET = 'x'.repeat(32);

describe('isUniqueViolation', () => {
  it('recognises Postgres error code 23505', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation(new Error('nope'))).toBe(false);
  });

  // drizzle-orm >= 0.44 hands us the driver error wrapped in DrizzleQueryError,
  // so this uses the real class rather than a hand-rolled shape.
  it('sees through the DrizzleQueryError wrapper drizzle-orm >= 0.44 throws', () => {
    const violation = Object.assign(new Error('duplicate key'), { code: '23505' });
    expect(isUniqueViolation(new DrizzleQueryError('insert ...', [], violation))).toBe(true);

    const otherFailure = Object.assign(new Error('fk violation'), { code: '23503' });
    expect(isUniqueViolation(new DrizzleQueryError('insert ...', [], otherFailure))).toBe(false);
    expect(isUniqueViolation(new DrizzleQueryError('insert ...', [], undefined))).toBe(false);
  });

  it('does not loop forever on a self-referencing cause chain', () => {
    const looped: { code: string; cause?: unknown } = { code: '23503' };
    looped.cause = looped;
    expect(isUniqueViolation(looped)).toBe(false);
  });
});

describe('issueToken', () => {
  it('signs a verifiable JWT carrying id and role', async () => {
    const { token, expiresIn } = await issueToken({ id: 'u1', role: 'adult' }, SECRET, 3600);
    expect(expiresIn).toBe(3600);
    const claims = await verifyToken(token, SECRET);
    expect(claims.sub).toBe('u1');
    expect(claims.role).toBe('adult');
  });

  it('stamps iss/aud when given, and omits them when not', async () => {
    const stamped = await issueToken({ id: 'u1', role: 'adult' }, SECRET, 3600, {
      iss: 'heorth',
      aud: 'kithledger',
    });
    const claims = await verifyToken(stamped.token, SECRET, { iss: 'heorth', aud: 'kithledger' });
    expect(claims.iss).toBe('heorth');
    expect(claims.aud).toBe('kithledger');

    const plain = await issueToken({ id: 'u1', role: 'adult' }, SECRET, 3600);
    const plainClaims = await verifyToken(plain.token, SECRET);
    expect(plainClaims.iss).toBeUndefined();
    expect(plainClaims.aud).toBeUndefined();
  });
});

describe('createUser', () => {
  const input: CreateUserInput = { email: 'a@b.co', handle: 'ab', password: 'pw1234567890' };

  it('inserts and returns a user without the password hash', async () => {
    const row = {
      id: 'u1',
      email: 'a@b.co',
      handle: 'ab',
      passwordHash: 'hashed',
      role: 'adult',
      displayName: null,
      avatarColor: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const db = {
      insert: () => ({ values: () => ({ returning: async () => [row] }) }),
    } as unknown as CoreDb;

    const user = await createUser(db, input);
    expect(user).not.toHaveProperty('passwordHash');
    expect(user.email).toBe('a@b.co');
  });

  it('maps a 23505 unique violation to a CONFLICT error', async () => {
    const db = {
      insert: () => ({
        values: () => ({
          returning: async () => {
            throw { code: '23505' };
          },
        }),
      }),
    } as unknown as CoreDb;

    await expect(createUser(db, input)).rejects.toThrow('CONFLICT');
  });
});
