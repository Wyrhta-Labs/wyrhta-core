import { describe, it, expect } from 'vitest';
import { parsePagination } from '../../src/http/pagination.js';

describe('parsePagination', () => {
  it('applies defaults when absent', () => {
    expect(parsePagination({})).toEqual({ limit: 20, offset: 0 });
  });

  it('clamps limit to a max of 100', () => {
    expect(parsePagination({ limit: '500' }).limit).toBe(100);
  });

  it('clamps limit to a min of 1', () => {
    expect(parsePagination({ limit: '0' }).limit).toBe(1);
  });

  it('parses offset and floors it at 0', () => {
    expect(parsePagination({ offset: '40' }).offset).toBe(40);
    expect(parsePagination({ offset: '-5' }).offset).toBe(0);
  });

  it('falls back to defaults on non-numeric input', () => {
    expect(parsePagination({ limit: 'abc', offset: 'xyz' })).toEqual({ limit: 20, offset: 0 });
  });
});
