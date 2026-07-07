/**
 * Flinks maps every failure to a stable, machine-readable `FlinksCode` string.
 * `FlinksError` surfaces that code alongside the HTTP status and a plain-English
 * description, so callers can branch on `error.flinksCode` without parsing text.
 */

import { flinksCodeDescriptions } from './flinks-codes.js';

export interface FlinksErrorBody {
  httpStatusCode?: number;
  flinksCode?: string;
  message?: string;
  [key: string]: unknown;
}

export class FlinksError extends Error {
  /** The HTTP status code returned by Flinks (e.g. 401, 500). */
  readonly httpStatusCode?: number;
  /** The stable Flinks error code, e.g. `INVALID_LOGIN`. */
  readonly flinksCode?: string;
  /** The raw message string from the Flinks response, if any. */
  readonly flinksMessage?: string;
  /** A human-readable description of `flinksCode`, when known. */
  readonly description?: string;
  /** The endpoint that failed, e.g. `authorize`. */
  readonly endpoint: string;
  /** The full parsed response body, for debugging. */
  readonly body: FlinksErrorBody;

  constructor(endpoint: string, body: FlinksErrorBody) {
    const code = body.flinksCode;
    const description = code ? flinksCodeDescriptions[code] : undefined;
    super(
      `Flinks ${endpoint} failed: ${body.httpStatusCode ?? '?'} ${code ?? ''}`.trim(),
    );
    this.name = 'FlinksError';
    this.endpoint = endpoint;
    this.httpStatusCode = body.httpStatusCode;
    this.flinksCode = code;
    this.flinksMessage = body.message;
    this.description = description ?? (code ? `Unknown Flinks code: ${code}` : undefined);
    this.body = body;
  }
}
