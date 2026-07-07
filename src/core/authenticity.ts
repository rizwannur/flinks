/**
 * Webhook signature helpers.
 *
 * Flinks signs webhook payloads with an HMAC-SHA256 over the raw body. Verify
 * incoming webhooks with `isWebhookValid` before trusting them. Comparison is
 * constant-time to avoid leaking the signature through timing.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Compute the base64 HMAC-SHA256 signature of a message. */
export const signMessage = (message: string, signingKey: string): string =>
  createHmac('sha256', signingKey).update(message).digest('base64');

/**
 * Verify a webhook signature in constant time.
 * @param message the raw request body, exactly as received
 * @param signature the signature header sent by Flinks (base64)
 * @param verificationKey your webhook verification key
 */
export const isWebhookValid = (
  message: string,
  signature: string,
  verificationKey: string,
): boolean => {
  const expected = signMessage(message, verificationKey);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
};
