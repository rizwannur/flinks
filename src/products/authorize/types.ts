import type { FlinksResponseBase, Login } from '../../types/index.js';

export interface AuthorizeOptions {
  /** LoginId returned by Flinks Connect. Pair with `mostRecentCached: true`. */
  loginId?: string;
  /** Cached mode (default true). Set false for a live connection. */
  mostRecentCached?: boolean;
  /** Legacy/live direct-connection username (when `mostRecentCached` is false). */
  username?: string;
  /** Legacy/live direct-connection password. */
  password?: string;
  /** Legacy institution identifier. */
  institution?: string;
  /** Response language: `en` or `fr`. Default `en`. */
  language?: 'en' | 'fr';
  /** Persist collected data/credentials. Default true. */
  save?: boolean;
  /** Custom tag echoed back on the request. */
  tag?: string;
  /** Required when answering MFA — the RequestId from the 203 response. */
  requestId?: string;
  /** MFA answers, keyed by challenge prompt. */
  securityResponses?: Record<string, string[]>;
}

export interface SecurityChallenge {
  prompt: string;
  type?: string;
  iterables?: string[];
}

export interface AuthorizeResponse extends FlinksResponseBase {
  requestId: string;
  institutionName?: string;
  institution?: string;
  institutionId?: number;
  login?: Login;
  /** Present on a 203 response — resubmit with answers in `securityResponses`. */
  securityChallenges?: SecurityChallenge[];
}

export interface GenerateAuthorizeTokenResponse extends FlinksResponseBase {
  /** The Authorize Token (RequestId), valid 30 minutes of inactivity. */
  requestId: string;
}
