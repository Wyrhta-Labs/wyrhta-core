import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type { CoreDb } from './client.js';

/** Run migrations from the given folder against the given Drizzle client. */
export async function runMigrations(db: CoreDb, migrationsFolder: string): Promise<void> {
  await migrate(db, { migrationsFolder });
}

/**
 * Absolute path to core's own migration SQL (identity + household). Apps can
 * run these before their own migrations:
 *   await runMigrations(db, coreMigrationsFolder());
 */
export function coreMigrationsFolder(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, 'migrations');
}
