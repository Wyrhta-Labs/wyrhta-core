import { describe, it, expect, vi } from 'vitest';
import { household } from '../../src/household/schema.js';
import { seedHousehold, setRole } from '../../src/household/service.js';
import type { CoreDb } from '../../src/db/client.js';

describe('household schema', () => {
  it('has a singleton guard column plus name/timezone/locale', () => {
    const cols = Object.keys(household);
    expect(cols).toEqual(
      expect.arrayContaining(['id', 'singleton', 'name', 'timezone', 'locale', 'createdAt'])
    );
  });
});

describe('seedHousehold', () => {
  it('returns the existing household without inserting when one exists', async () => {
    const existing = { id: 'h1', singleton: true, name: 'Home', timezone: 'UTC', locale: 'en-US', createdAt: new Date() };
    const insert = vi.fn();
    const db = {
      select: () => ({ from: () => ({ limit: async () => [existing] }) }),
      insert,
    } as unknown as CoreDb;

    const result = await seedHousehold(db, { name: 'Ignored' });
    expect(result).toBe(existing);
    expect(insert).not.toHaveBeenCalled();
  });

  it('inserts with defaults when none exists', async () => {
    const created = { id: 'h2', singleton: true, name: 'Home', timezone: 'UTC', locale: 'en-US', createdAt: new Date() };
    const values = vi.fn(() => ({ returning: async () => [created] }));
    const db = {
      select: () => ({ from: () => ({ limit: async () => [] }) }),
      insert: () => ({ values }),
    } as unknown as CoreDb;

    const result = await seedHousehold(db, { name: 'Home' });
    expect(result).toBe(created);
    expect(values).toHaveBeenCalledWith({ name: 'Home', timezone: 'UTC', locale: 'en-US' });
  });
});

describe('setRole', () => {
  it('updates the user role and returns the row', async () => {
    const updated = { id: 'u1', role: 'child' };
    const db = {
      update: () => ({ set: () => ({ where: () => ({ returning: async () => [updated] }) }) }),
    } as unknown as CoreDb;

    const result = await setRole(db, 'u1', 'child');
    expect(result).toBe(updated);
  });
});
