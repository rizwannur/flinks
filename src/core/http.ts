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
import { FlinksError, type FlinksErrorBody } from './errors.js';

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

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

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

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          ...init,
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (RETRYABLE_STATUS.has(response.status) && attempt < this.maxRetries) {
          await sleep(this.backoff(attempt, response));
          continue;
        }

        return await this.handleResponse<T>(response, options);
      } catch (error) {
        clearTimeout(timer);
        // FlinksError is a definitive API answer — never retry it.
        if (error instanceof FlinksError) throw error;
        lastError = error;
        if (attempt < this.maxRetries) {
          await sleep(this.backoff(attempt));
          continue;
        }
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
    else if (auth.type === 'x-api-key') headers['x-api-key'] = auth.token;
    else if (auth.type === 'bearer') headers['Authorization'] = `Bearer ${auth.token}`;

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
    const parsed: unknown = text ? safeJsonParse(text) : undefined;

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

    if (options.transformResponse === false) return parsed as T;
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

const safeJsonParse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
