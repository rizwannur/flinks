import { describe, expect, it } from 'vitest';
import { isPending, poll } from '../src/core/poll.js';

describe('poll', () => {
  it('detects pending responses', () => {
    expect(isPending({ httpStatusCode: 202 })).toBe(true);
    expect(isPending({ flinksCode: 'OPERATION_PENDING' })).toBe(true);
    expect(isPending({ httpStatusCode: 200 })).toBe(false);
  });

  it('polls until a non-pending result', async () => {
    const results = [
      { httpStatusCode: 202 },
      { httpStatusCode: 202 },
      { httpStatusCode: 200, requestId: 'done' },
    ];
    let i = 0;
    const out = await poll(() => Promise.resolve(results[i++]!), { intervalMs: 1 });
    expect(out).toMatchObject({ httpStatusCode: 200, requestId: 'done' });
    expect(i).toBe(3);
  });

  it('times out when the result never settles', async () => {
    await expect(
      poll(() => Promise.resolve({ httpStatusCode: 202 }), { intervalMs: 1, timeoutMs: 5 }),
    ).rejects.toThrow(/still pending/);
  });
});
