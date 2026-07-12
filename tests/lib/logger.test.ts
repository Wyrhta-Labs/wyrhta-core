import { describe, it, expect, vi, afterEach } from 'vitest';
import { logEvent, logError } from '../../src/lib/logger.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logEvent', () => {
  it('writes JSON to stdout with an injected timestamp and the event name', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logEvent({ event: 'auth.token.success', success: true });
    expect(spy).toHaveBeenCalledOnce();
    const payload = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(payload.event).toBe('auth.token.success');
    expect(payload.success).toBe(true);
    expect(typeof payload.timestamp).toBe('string');
  });
});

describe('logError', () => {
  it('writes JSON to stderr with level=error and the message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logError('boom', new Error('kaboom'));
    const payload = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(payload.level).toBe('error');
    expect(payload.message).toBe('boom');
    expect(typeof payload.stack).toBe('string');
  });
});
