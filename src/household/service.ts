import { eq } from 'drizzle-orm';
import type { CoreDb } from '../db/client.js';
import { users, type Role } from '../identity/schema.js';
import { household, type Household } from './schema.js';

export interface SeedHouseholdInput {
  name: string;
  timezone?: string;
  locale?: string;
}

/** Create the singleton household at first boot; idempotent. */
export async function seedHousehold(db: CoreDb, input: SeedHouseholdInput): Promise<Household> {
  const [existing] = await db.select().from(household).limit(1);
  if (existing) return existing;

  const [row] = await db
    .insert(household)
    .values({
      name: input.name,
      timezone: input.timezone ?? 'UTC',
      locale: input.locale ?? 'en-US',
    })
    .returning();
  if (!row) throw new Error('Failed to seed household');
  return row;
}

/** Every user in the instance belongs to the one household; role lives on the user. */
export async function listMembers(db: CoreDb) {
  return db
    .select({
      id: users.id,
      email: users.email,
      handle: users.handle,
      role: users.role,
      displayName: users.displayName,
      avatarColor: users.avatarColor,
    })
    .from(users)
    .orderBy(users.createdAt);
}

export async function setRole(db: CoreDb, userId: string, role: Role) {
  const [row] = await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return row ?? null;
}
