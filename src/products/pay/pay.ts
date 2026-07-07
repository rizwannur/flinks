import type { HttpClient } from '../../core/http.js';

export interface PayAuthorizeOptions {
  username: string;
  password: string;
  /** OAuth grant type. Default `client_credentials`. */
  grantType?: string;
}

export interface PayAuthorizeResponse {
  accessToken: string;
  tokenType: string;
  /** Lifetime in seconds (default 299). Tokens are single-use per session. */
  expiresIn: number;
}

/**
 * Flinks Pay — Interac e-Transfer and EFT payments. Lives on its own host.
 * Start every session by calling `authorize` to mint a single-use access token,
 * then pass it as the Bearer token on subsequent Pay calls.
 */
export class PayApi {
  constructor(private readonly http: HttpClient) {}

  /**
   * Mint a Flinks Pay session token. Credentials are sent form-encoded; the
   * returned `accessToken` is single-use — call this again before each session.
   */
  authorize(options: PayAuthorizeOptions): Promise<PayAuthorizeResponse> {
    return this.http.request<PayAuthorizeResponse>({
      method: 'POST',
      path: '/api/v1/authorize',
      endpoint: 'payAuthorize',
      auth: { type: 'none' },
      form: {
        grant_type: options.grantType ?? 'client_credentials',
        Username: options.username,
        Password: options.password,
      },
    });
  }
}
