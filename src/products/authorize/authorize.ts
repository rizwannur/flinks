import type { HttpClient } from '../../core/http.js';
import type {
  AuthorizeOptions,
  AuthorizeResponse,
  GenerateAuthorizeTokenResponse,
} from './types.js';

const AUTHORIZE_DEFAULTS = {
  mostRecentCached: true,
  language: 'en' as const,
  save: true,
};

/**
 * Flinks Authorize — mint an Authorize Token and exchange a LoginId (or live
 * credentials) for a RequestId used by every downstream data call.
 */
export class AuthorizeApi {
  constructor(
    private readonly http: HttpClient,
    private readonly basePath: string,
  ) {}

  /**
   * Get an Authorize Token (RequestId), valid 30 minutes of inactivity.
   * Authenticated with your API secret via the `flinks-auth-key` header.
   */
  generateAuthorizeToken(apiSecret: string): Promise<GenerateAuthorizeTokenResponse> {
    return this.http.request<GenerateAuthorizeTokenResponse>({
      method: 'POST',
      path: `${this.basePath}/GenerateAuthorizeToken`,
      endpoint: 'generateAuthorizeToken',
      auth: { type: 'flinks-auth-key', token: apiSecret },
    });
  }

  /**
   * Authorize a card. Returns a RequestId on success (200) or, when the bank
   * requires it, a set of `securityChallenges` (203) — answer them by calling
   * `authorize` again with the same `requestId` and `securityResponses`.
   */
  authorize(options: AuthorizeOptions = {}): Promise<AuthorizeResponse> {
    return this.http.request<AuthorizeResponse>({
      method: 'POST',
      path: `${this.basePath}/Authorize`,
      endpoint: 'authorize',
      body: { ...AUTHORIZE_DEFAULTS, ...options },
    });
  }
}
