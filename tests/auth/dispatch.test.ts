import { describe, it, expect } from 'vitest';
import { detectAuthScheme } from '../../src/auth/dispatch.js';

describe('detectAuthScheme', () => {
  it('routes a prefixed Bearer token to the api-key path', () => {
    expect(detectAuthScheme('Bearer kl_abcdef', 'kl_')).toBe('api_key');
    expect(detectAuthScheme('Bearer he_abcdef', 'he_')).toBe('api_key');
  });

  it('routes an eyJ Bearer token to the jwt path', () => {
    expect(detectAuthScheme('Bearer eyJhbGciOi.payload.sig', 'kl_')).toBe('jwt');
  });

  it('returns null for a missing or malformed header', () => {
    expect(detectAuthScheme(undefined, 'kl_')).toBeNull();
    expect(detectAuthScheme('Basic abc', 'kl_')).toBeNull();
    expect(detectAuthScheme('Bearer ', 'kl_')).toBeNull();
    expect(detectAuthScheme('Bearer mystery', 'kl_')).toBeNull();
  });

  it('does not treat a jwt as an api key when prefixes differ', () => {
    expect(detectAuthScheme('Bearer eyJabc', 'he_')).toBe('jwt');
  });
});
