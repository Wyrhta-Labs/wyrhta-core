import { createHash, randomBytes } from 'crypto';

/**
 * Generate an API key with an app-configurable prefix (e.g. `kl_`, `he_`).
 * The raw key is `<prefix>` + 32 random bytes as hex. Only the SHA-256 hash is
 * ever persisted; `raw` is shown to the user exactly once at creation.
 */
export function generateApiKey({ prefix }: { prefix: string }): {
  raw: string;
  hash: string;
  prefix: string;
} {
  const bytes = randomBytes(32).toString('hex');
  const raw = `${prefix}${bytes}`;
  const hash = hashKey(raw);
  const displayPrefix = raw.slice(0, prefix.length + 8);
  return { raw, hash, prefix: displayPrefix };
}

export function hashKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
