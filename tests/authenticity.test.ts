import { describe, expect, it } from 'vitest';
import { isWebhookValid, signMessage } from '../src/core/authenticity.js';

describe('webhook authenticity', () => {
  const key = 'super-secret';
  const body = '{"event":"card.linked"}';

  it('accepts a valid signature', () => {
    const sig = signMessage(body, key);
    expect(isWebhookValid(body, sig, key)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const sig = signMessage(body, key);
    expect(isWebhookValid('{"event":"tampered"}', sig, key)).toBe(false);
  });

  it('rejects a wrong key', () => {
    const sig = signMessage(body, key);
    expect(isWebhookValid(body, sig, 'other-key')).toBe(false);
  });

  it('rejects a malformed signature without throwing', () => {
    expect(isWebhookValid(body, 'not-base64!!', key)).toBe(false);
  });
});
