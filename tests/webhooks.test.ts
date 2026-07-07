import { describe, expect, it } from 'vitest';
import {
  signMessage,
  handleFlinksWebhook,
  verifyFlinksWebhook,
  parseFlinksWebhook,
  WebhookVerificationError,
  FLINKS_WEBHOOK_SIGNATURE_HEADER,
} from '../src/index.js';

const secret = 'hmac-secret';

describe('webhook receiver', () => {
  const body = JSON.stringify({ ResponseType: 'GetAccountsDetail', LoginId: 'l1', Tag: 'user=42' });
  const sig = signMessage(body, secret);

  it('verifies + parses a valid webhook from a Headers object', () => {
    const headers = new Headers({ [FLINKS_WEBHOOK_SIGNATURE_HEADER]: sig });
    const event = handleFlinksWebhook(body, headers, secret);
    expect(event.responseType).toBe('GetAccountsDetail');
    expect(event.loginId).toBe('l1');
    expect(event.tag).toBe('user=42');
  });

  it('works with a Node req.headers record', () => {
    const headers = { [FLINKS_WEBHOOK_SIGNATURE_HEADER]: sig };
    expect(verifyFlinksWebhook(body, headers, secret)).toBe(true);
  });

  it('throws on a bad signature', () => {
    const headers = new Headers({ [FLINKS_WEBHOOK_SIGNATURE_HEADER]: 'wrong' });
    expect(() => handleFlinksWebhook(body, headers, secret)).toThrow(WebhookVerificationError);
  });

  it('throws on a missing signature', () => {
    expect(() => handleFlinksWebhook(body, new Headers(), secret)).toThrow(WebhookVerificationError);
  });

  it('parseFlinksWebhook camelCases without verifying', () => {
    expect(parseFlinksWebhook(body).responseType).toBe('GetAccountsDetail');
  });
});
