import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export type CoreDb = PostgresJsDatabase<Record<string, unknown>>;

export interface CreateDbOptions<TSchema extends Record<string, unknown>> {
  databaseUrl: string;
  schema: TSchema;
  poolMax?: number;
}

/**
 * Build a Drizzle client over postgres.js. Connection is lazy — nothing hits
 * the network until the first query, so this is safe to construct at import
 * time and in unit tests.
 */
export function createDb<TSchema extends Record<string, unknown>>(
  options: CreateDbOptions<TSchema>
): PostgresJsDatabase<TSchema> {
  const client = postgres(options.databaseUrl, { max: options.poolMax ?? 10 });
  return drizzle(client, { schema: options.schema });
}
