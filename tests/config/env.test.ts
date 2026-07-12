import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { baseEnvSchema, parseEnv } from '../../src/config/env.js';

const VALID = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  JWT_SECRET: 'x'.repeat(32),
};

describe('baseEnvSchema', () => {
  it('rejects a JWT_SECRET shorter than 32 chars', () => {
    const result = baseEnvSchema.safeParse({ ...VALID, JWT_SECRET: 'short' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-URL DATABASE_URL', () => {
    const result = baseEnvSchema.safeParse({ ...VALID, DATABASE_URL: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('applies defaults for optional vars', () => {
    const result = baseEnvSchema.safeParse(VALID);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.JWT_TTL_SECONDS).toBe(604800);
      expect(result.data.DB_POOL_MAX).toBe(10);
      expect(result.data.CORS_ORIGIN).toBe('*');
    }
  });

  it('parseEnv returns typed env from an injected source', () => {
    const env = parseEnv(undefined, VALID);
    expect(env.JWT_SECRET).toBe(VALID.JWT_SECRET);
  });

  it('parseEnv merges an extension schema', () => {
    const env = parseEnv({ API_PORT: z.coerce.number().int().default(3000) }, VALID);
    expect(env.DATABASE_URL).toBe(VALID.DATABASE_URL);
    expect(env.API_PORT).toBe(3000);
  });
});
