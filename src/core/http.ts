/**
 * The single HTTP layer every product sits on.
 *
 * Flinks is not one API but several, spread across three hosts and three auth
 * schemes. Rather than special-case each product, `HttpClient` is configured
 * with a base URL and a default auth scheme, and every request may override the
 * method, auth, body encoding, and headers. Requests are retried on transient
 * failures, time out via `AbortController`, and are key-cased on the way in and
 * out so callers only ever see idiomatic camelCase.
 */

import { toPascalCase, toCamelCase } from './case.js';
import { FlinksError, FlinksTimeoutError, type FlinksErrorBody } from './errors.js';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/** How a request authenticates. Products default to one but may override. */
export type AuthScheme =
  | { type: 'flinks-auth-key'; token: string }
  | { type: 'x-api-key'; token: string }
  | { type: 'bearer'; token: string }
  | { type: 'none' };

export interface RequestOptions {
  method: HttpMethod;
  /** Path relative to the client base URL, with leading slash. */
  path: string;
  /** Human label used in thrown errors, e.g. `authorize`. */
  endpoint: string;
  /** JSON body. Deep-converted to PascalCase unless `transformRequest` is false. */
  body?: unknown;
  /** Query-string params. Undefined values are dropped. */
  query?: Record<string, string | number | boolean | undefined>;
  /** Form-urlencoded body (Flinks Pay). Sent as-is, no case transform. */
  form?: Record<string, string>;
  /** Extra headers, merged over the defaults. */
  headers?: Record<string, string>;
  /** Overrides the client's default auth scheme for this call. */
  auth?: AuthScheme;
  /** Set false to send the JSON body verbatim (no PascalCase transform). */
  transformRequest?: boolean;
  /** Set false to return the response body verbatim (no camelCase transform). */
  transformResponse?: boolean;
  /** Caller cancellation. Aborting rejects with the caller's own AbortError. */
  signal?: AbortSignal;
}

export interface HttpClientConfig {
  baseUrl: string;
  auth: AuthScheme;
  /** Request timeout in milliseconds. Default 60_000. */
  timeoutMs?: number;
  /** Max retry attempts for transient failures (429/5xx/network). Default 2. */
  maxRetries?: number;
  /** Injectable fetch, primarily for testing. Defaults to global `fetch`. */
  fetch?: typeof fetch;
}

// 429/408 mean the request was never processed, so retrying is always safe.
// Other 5xx are ambiguous for non-idempotent methods (the write may have landed),
// so those are only retried for idempotent GETs.
const ALWAYS_SAFE_STATUS = new Set([408, 429]);
const IDEMPOTENT_5XX_STATUS = new Set([500, 502, 503, 504]);

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class HttpClient {
  private readonly baseUrl: string;
  private readonly auth: AuthScheme;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.auth = config.auth;
    this.timeoutMs = config.timeoutMs ?? 60_000;
    this.maxRetries = config.maxRetries ?? 2;
    this.fetchImpl = config.fetch ?? globalThis.fetch;
    if (!this.fetchImpl) {
      throw new Error(
        'No global fetch available. Use Node 18+, Bun, or pass a fetch implementation.',
      );
    }
  }

  async request<T>(options: RequestOptions): Promise<T> {
    const url = this.buildUrl(options.path, options.query);
    const init = this.buildInit(options);

    // Retrying a POST/PATCH after a network error or ambiguous 5xx risks a
    // duplicate side effect (e.g. a double payment), so only GETs get that
    // treatment. 429/408 are always safe — the server never processed them.
    const idempotent = options.method === 'GET';

    // A caller cancellation that has already fired should never reach the wire.
    if (options.signal?.aborted) throw options.signal.reason ?? new Error('Aborted');

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, this.timeoutMs);
      // Forward a caller's cancellation to this attempt's controller.
      const onCallerAbort = () => controller.abort();
      options.signal?.addEventListener('abort', onCallerAbort, { once: true });
      const cleanup = (): void => {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', onCallerAbort);
      };
      try {
        const response = await this.fetchImpl(url, {
          ...init,
          signal: controller.signal,
        });
        cleanup();

        const retryable =
          ALWAYS_SAFE_STATUS.has(response.status) ||
          (idempotent && IDEMPOTENT_5XX_STATUS.has(response.status));
        if (retryable && attempt < this.maxRetries) {
          await sleep(this.backoff(attempt, response));
          continue;
        }

        return await this.handleResponse<T>(response, options);
      } catch (error) {
        cleanup();
        // FlinksError is a definitive API answer — never retry it.
        if (error instanceof FlinksError) throw error;
        // A deliberate caller cancellation is final — surface it, don't retry.
        if (options.signal?.aborted) throw options.signal.reason ?? error;
        // Our own timeout: replace the opaque AbortError with a typed error.
        const surfaced = timedOut
          ? new FlinksTimeoutError(options.endpoint, this.timeoutMs)
          : error;
        lastError = surfaced;
        // A transport error (or timeout) on a non-idempotent request may still
        // have been applied server-side — don't silently repeat it.
        if (idempotent && attempt < this.maxRetries) {
          await sleep(this.backoff(attempt));
          continue;
        }
        throw surfaced;
      }
    }
    throw lastError;
  }

  private buildUrl(
    path: string,
    query?: RequestOptions['query'],
  ): string {
    const url = new URL(this.baseUrl + path);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private buildInit(options: RequestOptions): RequestInit {
    const headers: Record<string, string> = { Accept: 'application/json' };

    const auth = options.auth ?? this.auth;
    if (auth.type === 'flinks-auth-key') headers['flinks-auth-key'] = auth.token;
    else if (auth.type === 'x-api-key') {
      // Fail loudly rather than sending an empty key and getting an opaque 401.
      if (!auth.token) {
        throw new Error(
          `Flinks ${options.endpoint} needs an API key. Pass \`xApiKey\` to ` +
            `FlinksClient — data endpoints (Connect, Enrich, Upload, Identity) ` +
            `authenticate with the x-api-key header.`,
        );
      }
      headers['x-api-key'] = auth.token;
    } else if (auth.type === 'bearer') headers['Authorization'] = `Bearer ${auth.token}`;

    let body: string | undefined;
    if (options.form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(options.form).toString();
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      const payload =
        options.transformRequest === false
          ? options.body
          : toPascalCase(options.body);
      body = JSON.stringify(payload);
    }

    return { method: options.method, headers: { ...headers, ...options.headers }, body };
  }

  private async handleResponse<T>(
    response: Response,
    options: RequestOptions,
  ): Promise<T> {
    const text = await response.text();
    const { value: parsed, jsonOk } = text
      ? tryJsonParse(text)
      : { value: undefined, jsonOk: true };

    if (!response.ok) {
      const raw = (isRecord(parsed) ? parsed : {}) as Record<string, unknown>;
      const errorBody: FlinksErrorBody = {
        httpStatusCode: (raw['HttpStatusCode'] as number) ?? response.status,
        flinksCode: raw['FlinksCode'] as string | undefined,
        message: (raw['Message'] as string) ?? (typeof parsed === 'string' ? parsed : undefined),
        ...raw,
      };
      throw new FlinksError(options.endpoint, errorBody);
    }

    // Caller asked for the raw body — hand it back untouched (text or parsed).
    if (options.transformResponse === false) return parsed as T;

    // A 2xx with a non-empty body that isn't valid JSON means something is
    // wrong upstream (a truncated response, or an HTML proxy/gateway page
    // returned with status 200). Returning that string cast to T would
    // silently corrupt the caller's data model, so fail loudly instead.
    if (!jsonOk) {
      throw new FlinksError(options.endpoint, {
        httpStatusCode: response.status,
        message: `Expected a JSON response but received a non-JSON body: ${text.slice(0, 200)}`,
        body: text,
      });
    }

    return toCamelCase<T>(parsed);
  }

  private backoff(attempt: number, response?: Response): number {
    const retryAfter = response?.headers.get('retry-after');
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (!Number.isNaN(seconds)) return seconds * 1000;
    }
    // Exponential backoff with light jitter: 250ms, 500ms, 1s, ...
    const base = 250 * 2 ** attempt;
    return base + Math.floor(Math.random() * 100);
  }
}

// Parses JSON but reports whether it actually succeeded, so callers can tell a
// genuine JSON string (`"hi"`) apart from a body that failed to parse.
const tryJsonParse = (text: string): { value: unknown; jsonOk: boolean } => {
  try {
    return { value: JSON.parse(text), jsonOk: true };
  } catch {
    return { value: text, jsonOk: false };
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
