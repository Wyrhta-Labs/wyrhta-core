import { and, eq } from 'drizzle-orm';
import type { CoreDb } from '../db/client.js';
import { users, apiKeys, type Role, type User } from './schema.js';
import { hashPassword, verifyPassword } from './password.js';
import { signToken, type TokenIdentityOptions } from './jwt.js';
import { generateKey } from './api-key.js';

export type PublicUser = Omit<User, 'passwordHash'>;

export interface CreateUserInput {
  email: string;
  handle: string;
  password: string;
  role?: Role;
  displayName?: string | null;
  avatarColor?: string | null;
}

/** True for a Postgres UNIQUE constraint violation (code 23505). */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  );
}

function toPublic(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

export async function createUser(db: CoreDb, input: CreateUserInput): Promise<PublicUser> {
  const passwordHash = await hashPassword(input.password);
  try {
    const [row] = await db
      .insert(users)
      .values({
        email: input.email,
        handle: input.handle,
        passwordHash,
        role: input.role ?? 'adult',
        displayName: input.displayName ?? null,
        avatarColor: input.avatarColor ?? null,
      })
      .returning();
    if (!row) throw new Error('Failed to create user');
    return toPublic(row);
  } catch (error: unknown) {
    if (isUniqueViolation(error)) throw new Error('CONFLICT');
    throw error;
  }
}

export async function authenticate(
  db: CoreDb,
  email: string,
  password: string
): Promise<PublicUser | null> {
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!row) return null;
  const valid = await verifyPassword(row.passwordHash, password);
  return valid ? toPublic(row) : null;
}

/**
 * Issue a JWT for `user`. `options.iss` / `options.aud` are optional and, when
 * omitted, the token keeps its historical `{ sub, role, iat, exp }` shape.
 */
export async function issueToken(
  user: { id: string; role: Role },
  secret: string,
  ttlSeconds: number,
  options: TokenIdentityOptions = {}
): Promise<{ token: string; expiresIn: number }> {
  const token = await signToken(
    { sub: user.id, role: user.role, iss: options.iss, aud: options.aud },
    secret,
    ttlSeconds
  );
  return { token, expiresIn: ttlSeconds };
}

export async function createApiKey(db: CoreDb, userId: string, name: string, prefix: string) {
  const { raw, hash, prefix: displayPrefix } = generateKey(prefix);
  const [row] = await db
    .insert(apiKeys)
    .values({ userId, name, keyHash: hash, prefix: displayPrefix })
    .returning();
  if (!row) throw new Error('Failed to create API key');
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    createdAt: row.createdAt,
    key: raw, // only time the raw key is returned
  };
}

export async function listApiKeys(db: CoreDb, userId: string) {
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(apiKeys.createdAt);
}

export async function revokeApiKey(db: CoreDb, userId: string, keyId: string): Promise<boolean> {
  const [row] = await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
    .returning();
  return !!row;
}
