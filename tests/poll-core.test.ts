import { describe, expect, it, vi } from 'vitest';
import { isPending, poll } from '../src/core/poll.js';

describe('isPending', () => {
  it('is true for 202 or OPERATION_PENDING', () => {
    expect(isPending({ httpStatusCode: 202 })).toBe(true);
    expect(isPending({ flinksCode: 'OPERATION_PENDING' })).toBe(true);
  });
  it('is false for terminal statuses / codes', () => {
    expect(isPending({ httpStatusCode: 200 })).toBe(false);
    expect(isPending({ httpStatusCode: 203 })).toBe(false); // MFA is terminal for poll
    expect(isPending({ flinksCode: 'INVALID_LOGIN' })).toBe(false);
  });
  it('does not throw on null/undefined/empty input', () => {
    expect(isPending(null as never)).toBe(false);
    expect(isPending(undefined as never)).toBe(false);
    expect(isPending({})).toBe(false);
  });
});

describe('poll', () => {
  it('returns the first non-pending result', async () => {
    const results = [
      { httpStatusCode: 202 },
      { httpStatusCode: 202 },
      { httpStatusCode: 200, requestId: 'done' },
    ];
    let i = 0;
    const out = await poll(() => Promise.resolve(results[i++]!), { intervalMs: 1 });
    expect(out).toMatchObject({ requestId: 'done' });
    expect(i).toBe(3);
  });

  it('returns immediately when the first result is already terminal', async () => {
    const fn = vi.fn(async () => ({ httpStatusCode: 200, requestId: 'r' }));
    await poll(fn, { intervalMs: 1 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('stops on a terminal ERROR status and returns it (does not throw)', async () => {
    const out = await poll(async () => ({ httpStatusCode: 401, flinksCode: 'INVALID_LOGIN' }), {
      intervalMs: 1,
    });
    expect(out).toMatchObject({ flinksCode: 'INVALID_LOGIN' });
  });

  it('resolves via OPERATION_PENDING → success even without 202', async () => {
    const results = [{ flinksCode: 'OPERATION_PENDING' }, { httpStatusCode: 200, requestId: 'ok' }];
    let i = 0;
    const out = await poll(() => Promise.resolve(results[i++]!), { intervalMs: 1 });
    expect(out).toMatchObject({ requestId: 'ok' });
  });

  it('times out when the result never settles', async () => {
    await expect(
      poll(() => Promise.resolve({ httpStatusCode: 202 }), { intervalMs: 1, timeoutMs: 5 }),
    ).rejects.toThrow(/still pending/);
  });

  it('respects a mid-flight abort signal', async () => {
    const ac = new AbortController();
    const p = poll(async () => ({ httpStatusCode: 202 }), { intervalMs: 50, signal: ac.signal });
    setTimeout(() => ac.abort(), 5);
    await expect(p).rejects.toThrow(/aborted/);
  });

  it('rejects immediately if the signal is already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(
      poll(async () => ({ httpStatusCode: 202 }), { intervalMs: 5, signal: ac.signal }),
    ).rejects.toThrow(/aborted/);
  });

  it('propagates an error thrown by fetchResult', async () => {
    await expect(
      poll(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});
