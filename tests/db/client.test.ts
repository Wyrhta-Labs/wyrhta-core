import { describe, it, expect } from 'vitest';
import { createDb, runMigrations, coreMigrationsFolder } from '../../src/db/index.js';

describe('createDb', () => {
  it('returns a drizzle client without connecting (lazy)', () => {
    const db = createDb({
      databaseUrl: 'postgres://u:p@localhost:5432/db',
      schema: {},
    });
    expect(db).toBeDefined();
    expect(typeof db.select).toBe('function');
  });
});

describe('runMigrations', () => {
  it('is a function', () => {
    expect(typeof runMigrations).toBe('function');
  });
});

describe('coreMigrationsFolder', () => {
  it('returns a string path ending in db/migrations', () => {
    expect(coreMigrationsFolder().replace(/\\/g, '/')).toMatch(/db\/migrations$/);
  });
});
