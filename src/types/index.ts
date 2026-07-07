/**
 * Types shared across every Flinks product.
 */

/** Flinks environments. `toolbox` and `sandbox` are for testing. */
export type FlinksInstance = 'toolbox' | 'sandbox' | 'production' | (string & {});

export interface FlinksConfig {
  /** Your Flinks environment. Determines the API host. */
  instance: FlinksInstance;
  /** Your Flinks customer GUID (a.k.a. customerId). */
  customerId: string;
  /**
   * Your API secret. Used as the default `flinks-auth-key` for BankingServices
   * and Enrich, and as the Bearer token for Upload and data-sharing utilities.
   * Optional if you pass per-call tokens instead.
   */
  apiSecret?: string;
  /** Request timeout in milliseconds. Default 60_000. */
  timeoutMs?: number;
  /** Max retries on transient failures (429/5xx/network). Default 2. */
  maxRetries?: number;
  /** Injectable fetch, primarily for testing. */
  fetch?: typeof fetch;
  /** Override product base hosts (advanced / self-hosted / testing). */
  hosts?: Partial<FlinksHosts>;
}

export interface FlinksHosts {
  /** BankingServices, Enrich, Upload, Utilities. */
  banking: string;
  /** Flinks Pay. */
  pay: string;
  /** Open Banking (Outbound). */
  outbound: string;
}

/** Every Flinks response carries these. */
export interface FlinksResponseBase {
  httpStatusCode: number;
  flinksCode?: string;
  message?: string;
  links?: FlinksLink[];
}

export interface FlinksLink {
  rel: string;
  href: string;
  example?: string;
}

/** An end-user's linked login, returned by Authorize and the account calls. */
export interface Login {
  username: string;
  isScheduledRefresh: boolean;
  lastRefresh: string;
  type: string;
  id: string;
}

/** Discriminates a completed (200) result from an async-pending (202) one. */
export type AsyncResult<T> =
  | ({ status: 'done' } & T)
  | ({ status: 'pending'; requestId: string } & FlinksResponseBase);
