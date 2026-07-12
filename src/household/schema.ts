import { pgTable, text, uuid, timestamp, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * The one household per instance. `singleton` is a UNIQUE boolean fixed to
 * `true`, so a second insert (also `true`) violates the constraint — enforcing
 * a single row at the DB level.
 */
export const household = pgTable('household', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  singleton: boolean('singleton').notNull().default(true).unique(),
  name: text('name').notNull(),
  timezone: text('timezone').notNull().default('UTC'),
  locale: text('locale').notNull().default('en-US'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export type Household = typeof household.$inferSelect;
