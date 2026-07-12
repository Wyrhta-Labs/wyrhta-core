import { describe, it, expect } from 'vitest';
import * as schema from '../../src/db/schema/index.js';

describe('db schema barrel', () => {
  it('re-exports the identity and household tables', () => {
    expect(schema.users).toBeDefined();
    expect(schema.apiKeys).toBeDefined();
    expect(schema.userRole).toBeDefined();
    expect(schema.household).toBeDefined();
  });
});
