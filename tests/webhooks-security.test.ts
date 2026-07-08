import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  signMessage,
  isWebhookValid,
  verifyFlinksWebhook,
  handleFlinksWebhook,
  parseFlinksWebhook,
  WebhookVerificationError,
  FLINKS_WEBHOOK_SIGNATURE_HEADER,
} from '../src/index.js';

const secret = 'hmac-secret';
const body = JSON.stringify({ ResponseType: 'GetAccountsDetail', LoginId: 'l1', Tag: 'user=42' });
const sig = signMessage(body, secret);

describe('signMessage', () => {
  it('produces a base64 HMAC-SHA256 matching Node crypto', () => {
    const expected = createHmac('sha256', secret).update(body).digest('base64');
    expect(sig).toBe(expected);
  });
});

describe('isWebhookValid', () => {
  it('accepts a correct signature', () => {
    expect(isWebhookValid(body, sig, secret)).toBe(true);
  });
  it('rejects a wrong secret', () => {
    expect(isWebhookValid(body, sig, 'other')).toBe(false);
  });
  it('rejects a tampered body', () => {
    expect(isWebhookValid(body + ' ', sig, secret)).toBe(false);
  });
  it('rejects an empty signature', () => {
    expect(isWebhookValid(body, '', secret)).toBe(false);
  });
  it('rejects a malformed (non-base64) signature without throwing', () => {
    expect(isWebhookValid(body, 'not base64 !!!', secret)).toBe(false);
  });
  it('rejects a correctly-signed but length-mismatched signature (timing-safe guard)', () => {
    // A signature one char short must never reach timingSafeEqual with unequal length.
    expect(isWebhookValid(body, sig.slice(0, -1), secret)).toBe(false);
  });
});

describe('verifyFlinksWebhook / handleFlinksWebhook', () => {
  it('verifies from a Headers object', () => {
    const headers = new Headers({ [FLINKS_WEBHOOK_SIGNATURE_HEADER]: sig });
    expect(verifyFlinksWebhook(body, headers, secret)).toBe(true);
  });

  it('verifies from a Node req.headers record', () => {
    expect(verifyFlinksWebhook(body, { [FLINKS_WEBHOOK_SIGNATURE_HEADER]: sig }, secret)).toBe(true);
  });

  it('reads the first value from an array header (Node duplicate header)', () => {
    const headers = { [FLINKS_WEBHOOK_SIGNATURE_HEADER]: [sig, 'garbage'] };
    expect(verifyFlinksWebhook(body, headers, secret)).toBe(true);
  });

  it('returns false when the header is absent', () => {
    expect(verifyFlinksWebhook(body, new Headers(), secret)).toBe(false);
  });

  it('handleFlinksWebhook parses + camelCases a verified event', () => {
    const headers = new Headers({ [FLINKS_WEBHOOK_SIGNATURE_HEADER]: sig });
    const event = handleFlinksWebhook(body, headers, secret);
    expect(event).toMatchObject({ responseType: 'GetAccountsDetail', loginId: 'l1', tag: 'user=42' });
  });

  it('throws WebhookVerificationError on a tampered payload', () => {
    const tampered = JSON.stringify({ ResponseType: 'GetAccountsDetail', LoginId: 'ATTACKER' });
    const headers = new Headers({ [FLINKS_WEBHOOK_SIGNATURE_HEADER]: sig });
    expect(() => handleFlinksWebhook(tampered, headers, secret)).toThrow(WebhookVerificationError);
  });

  it('throws on a missing signature header', () => {
    expect(() => handleFlinksWebhook(body, new Headers(), secret)).toThrow(WebhookVerificationError);
  });

  it('parseFlinksWebhook camelCases WITHOUT verifying (do not trust its output blindly)', () => {
    expect(parseFlinksWebhook(body).responseType).toBe('GetAccountsDetail');
  });

  it('SHARP EDGE: no replay protection — a captured valid (body,sig) verifies forever', () => {
    // There is no timestamp/nonce in the scheme, so a replayed delivery is indistinguishable.
    const headers = new Headers({ [FLINKS_WEBHOOK_SIGNATURE_HEADER]: sig });
    expect(verifyFlinksWebhook(body, headers, secret)).toBe(true);
    expect(verifyFlinksWebhook(body, headers, secret)).toBe(true);
  });
});
