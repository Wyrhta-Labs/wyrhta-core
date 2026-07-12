import { describe, it, expect } from 'vitest';
import { users, apiKeys, userRole } from '../../src/identity/schema.js';

describe('identity schema', () => {
  it('defines the user_role enum with admin/adult/child', () => {
    expect([...userRole.enumValues]).toEqual(['admin', 'adult', 'child']);
  });

  it('maps users to the expected columns', () => {
    const cols = Object.keys(users);
    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'email',
        'handle',
        'passwordHash',
        'role',
        'displayName',
        'avatarColor',
        'createdAt',
        'updatedAt',
      ])
    );
  });

  it('maps api_keys to the expected columns', () => {
    const cols = Object.keys(apiKeys);
    expect(cols).toEqual(
      expect.arrayContaining(['id', 'userId', 'name', 'keyHash', 'prefix', 'lastUsedAt', 'createdAt'])
    );
  });
});
