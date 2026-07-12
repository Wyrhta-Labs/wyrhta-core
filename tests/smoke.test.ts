import { describe, it, expect } from 'vitest';
import { CORE_VERSION } from '../src/index.js';

describe('package scaffolding', () => {
  it('exposes a version string', () => {
    expect(typeof CORE_VERSION).toBe('string');
    expect(CORE_VERSION.length).toBeGreaterThan(0);
  });
});
