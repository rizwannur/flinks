/**
 * Webhook signature helpers.
 *
 * Flinks signs webhook payloads with an HMAC-SHA256 over the raw body. Verify
 * incoming webhooks with `isWebhookValid` before trusting them. Comparison is
 * constant-time to avoid leaking the signature through timing.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** The header Flinks puts the webhook HMAC-SHA256 signature in. */
export const FLINKS_WEBHOOK_SIGNATURE_HEADER = 'flinks-authenticity-key';

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

/** Header sources `verifyFlinksWebhook` can read the signature from. */
type HeaderSource = Headers | Record<string, string | string[] | undefined>;

const readHeader = (headers: HeaderSource, name: string): string | undefined => {
  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(name) ?? undefined;
  }
  const value = (headers as Record<string, string | string[] | undefined>)[name];
  return Array.isArray(value) ? value[0] : value;
};

/**
 * Verify a Flinks webhook straight from its request.
 *
 * ```ts
 * // Next.js route handler
 * const raw = await req.text();
 * if (!verifyFlinksWebhook(raw, req.headers, process.env.FLINKS_HMAC_SECRET!)) {
 *   return new Response('Invalid signature', { status: 403 });
 * }
 * const event = JSON.parse(raw);
 * ```
 *
 * @param rawBody the exact request body bytes (do NOT re-serialize the parsed object)
 * @param headers a `Headers` object or a Node `req.headers` record
 * @param hmacSecret your Flinks HMAC secret
 */
export const verifyFlinksWebhook = (
  rawBody: string,
  headers: HeaderSource,
  hmacSecret: string,
): boolean => {
  const signature = readHeader(headers, FLINKS_WEBHOOK_SIGNATURE_HEADER);
  return typeof signature === 'string' && isWebhookValid(rawBody, signature, hmacSecret);
};
