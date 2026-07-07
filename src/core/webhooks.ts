/**
 * Receiving Flinks webhooks.
 *
 * Flinks does not expose a registration API — you enable webhooks by opening a
 * Flinks Support ticket with your URL + instance, and Flinks configures the
 * callback server-side. This module is the *receiving* half: verify the HMAC
 * signature, then parse the payload into a typed, camelCased event.
 *
 * Delivery semantics (from Flinks): any non-200 response is a failure; Flinks
 * retries up to 10 times, 30 minutes apart. So verify fast and return 200.
 */

import { toCamelCase } from './case.js';
import { isWebhookValid, FLINKS_WEBHOOK_SIGNATURE_HEADER } from './authenticity.js';

/** The `ResponseType` discriminator Flinks stamps on every webhook payload. */
export type FlinksWebhookType =
  | 'KYC'
  | 'GetAccountsDetail'
  | 'PayEvent'
  | 'UploadFraudAlert'
  | (string & {});

export interface FlinksWebhookEvent {
  /** Identifies the webhook kind — branch on this. */
  responseType: FlinksWebhookType;
  /** The Flinks connection id, present on account/KYC events. */
  loginId?: string;
  /** The request id tied to the data call, when applicable. */
  requestId?: string;
  /** Your custom `Tag` from the Connect flow, for correlating to your records. */
  tag?: string;
  [key: string]: unknown;
}

type HeaderSource = Headers | Record<string, string | string[] | undefined>;

const readHeader = (headers: HeaderSource, name: string): string | undefined => {
  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(name) ?? undefined;
  }
  const value = (headers as Record<string, string | string[] | undefined>)[name];
  return Array.isArray(value) ? value[0] : value;
};

/** Parse a raw webhook body into a typed, camelCased event (no verification). */
export const parseFlinksWebhook = (rawBody: string): FlinksWebhookEvent =>
  toCamelCase<FlinksWebhookEvent>(JSON.parse(rawBody));

export class WebhookVerificationError extends Error {
  constructor() {
    super('Flinks webhook signature verification failed');
    this.name = 'WebhookVerificationError';
  }
}

/**
 * Verify a webhook's HMAC signature and return the parsed event. Throws
 * `WebhookVerificationError` on a bad or missing signature.
 *
 * ```ts
 * // Next.js route handler
 * export async function POST(req: Request) {
 *   const raw = await req.text();
 *   let event;
 *   try {
 *     event = handleFlinksWebhook(raw, req.headers, process.env.FLINKS_HMAC_SECRET!);
 *   } catch {
 *     return new Response('bad signature', { status: 403 });
 *   }
 *   if (event.responseType === 'GetAccountsDetail') { ... }
 *   return new Response('ok'); // must be 200, or Flinks retries
 * }
 * ```
 */
export const handleFlinksWebhook = (
  rawBody: string,
  headers: HeaderSource,
  hmacSecret: string,
): FlinksWebhookEvent => {
  const signature = readHeader(headers, FLINKS_WEBHOOK_SIGNATURE_HEADER);
  if (!signature || !isWebhookValid(rawBody, signature, hmacSecret)) {
    throw new WebhookVerificationError();
  }
  return parseFlinksWebhook(rawBody);
};
