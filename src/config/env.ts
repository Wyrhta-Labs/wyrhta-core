import { z } from 'zod';

export const baseEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters for HS256 security'),
  JWT_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  CORS_ORIGIN: z.string().default('*'),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;

/**
 * Validate environment variables against the base schema, optionally extended
 * with app-specific fields. On failure prints field errors and exits the
 * process (startup guard). `source` defaults to `process.env`.
 */
export function parseEnv<T extends z.ZodRawShape>(
  extra?: T,
  source: Record<string, unknown> = process.env
): BaseEnv & (T extends z.ZodRawShape ? z.infer<z.ZodObject<T>> : unknown) {
  const schema = extra ? baseEnvSchema.extend(extra) : baseEnvSchema;
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    console.error('Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data as never;
}
