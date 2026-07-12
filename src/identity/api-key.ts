import { generateApiKey, hashKey } from '../lib/crypto.js';

export { hashKey };

export interface GeneratedKey {
  raw: string;
  hash: string;
  prefix: string;
}

/** Generate a new API key for the app's configured prefix (e.g. `kl_`, `he_`). */
export function generateKey(prefix: string): GeneratedKey {
  return generateApiKey({ prefix });
}

/**
 * Validate a raw API key by hashing it and delegating the record lookup to the
 * caller. Core stays DB-agnostic: apps pass a `lookup` closure over their
 * Drizzle client (e.g. `hash => db.select()...where(eq(apiKeys.keyHash, hash))`).
 */
export async function validateApiKey<T extends { keyHash: string }>(
  raw: string,
  lookup: (hash: string) => Promise<T | null>
): Promise<T | null> {
  const hash = hashKey(raw);
  return lookup(hash);
}
