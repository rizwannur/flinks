import type { HttpClient } from '../../core/http.js';
import { FlinksError } from '../../core/errors.js';
import { toPascalCase } from '../../core/case.js';
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
 * Flinks Authorize.
 *
 * The two-step token model, handled for you:
 *   1. `/GenerateAuthorizeToken` — authenticated with your **secret key**,
 *      returns a short-lived **authorize token**.
 *   2. `/Authorize` — authenticated with that **authorize token**, exchanges a
 *      LoginId (or live credentials) for a **RequestId** used by data calls.
 *
 * `authorize()` mints and caches the token automatically, so most callers never
 * touch `generateAuthorizeToken()` directly.
 */
export class AuthorizeApi {
  private authorizeToken?: string;

  constructor(
    private readonly http: HttpClient,
    private readonly basePath: string,
    private readonly secretKey?: string,
    authorizeToken?: string,
  ) {
    this.authorizeToken = authorizeToken;
  }

  /** Reuse a token you obtained elsewhere. */
  setAuthorizeToken(token: string): void {
    this.authorizeToken = token;
  }

  /**
   * Mint an authorize token (valid 30 min of inactivity) and cache it.
   * Authenticated with your secret key via the `flinks-auth-key` header.
   */
  async generateAuthorizeToken(secretKey?: string): Promise<GenerateAuthorizeTokenResponse> {
    const key = secretKey ?? this.secretKey;
    if (!key) {
      throw new Error(
        'Authorize: a secretKey is required to generate an authorize token. ' +
          'Pass it in the client config or to generateAuthorizeToken().',
      );
    }
    const result = await this.http.request<GenerateAuthorizeTokenResponse>({
      method: 'POST',
      path: `${this.basePath}/GenerateAuthorizeToken`,
      endpoint: 'generateAuthorizeToken',
      auth: { type: 'flinks-auth-key', token: key },
    });
    this.authorizeToken = result.token;
    return result;
  }

  private async ensureToken(explicit?: string): Promise<string> {
    if (explicit) return explicit;
    if (this.authorizeToken) return this.authorizeToken;
    return (await this.generateAuthorizeToken()).token;
  }

  /**
   * Authorize a card. Returns a RequestId on success (200) or, when the bank
   * requires it, a set of `securityChallenges` (203) — answer them by calling
   * `authorize` again with the same `requestId` and `securityResponses`.
   *
   * The authorize token is minted and refreshed automatically; on an expired
   * token the call is retried once with a fresh one.
   */
  async authorize(options: AuthorizeOptions = {}): Promise<AuthorizeResponse> {
    const { authorizeToken, securityResponses, ...rest } = options;
    // PascalCase the ordinary fields, but keep SecurityResponses keys verbatim —
    // those keys are the bank's exact challenge prompts (data, not field names),
    // and transforming them breaks MFA with UNKNOWN_CHALLENGE_KEY.
    const body: Record<string, unknown> = toPascalCase({ ...AUTHORIZE_DEFAULTS, ...rest });
    if (securityResponses) body['SecurityResponses'] = securityResponses;

    const send = (token: string) =>
      this.http.request<AuthorizeResponse>({
        method: 'POST',
        path: `${this.basePath}/Authorize`,
        endpoint: 'authorize',
        auth: { type: 'flinks-auth-key', token },
        body,
        transformRequest: false,
      });

    try {
      return await send(await this.ensureToken(authorizeToken));
    } catch (error) {
      // A stale/expired token surfaces as 401 — mint a fresh one and retry once.
      if (!authorizeToken && this.secretKey && error instanceof FlinksError && error.httpStatusCode === 401) {
        const fresh = await this.generateAuthorizeToken();
        return send(fresh.token);
      }
      throw error;
    }
  }
}
