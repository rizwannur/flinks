import type { HttpClient } from '../../core/http.js';
import { toSnakeCase } from '../../core/case.js';

export interface OutboundTokenOptions {
  /** `client_credentials` or `authorization_code`. */
  grantType: 'client_credentials' | 'authorization_code';
  clientId: string;
  clientSecret: string;
  /** e.g. `client:admin`. */
  scope?: string;
}

export interface OutboundTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  /** Only returned for the `authorization_code` grant. */
  refreshToken?: string;
  scope?: string;
}

export interface CreateDataRecipientOptions {
  /** Space-delimited; must include at least `ACCOUNT_BASIC`. */
  scope: string;
  redirectUris: string;
  logoUri?: string;
  country: 'CA' | 'US';
  description?: string;
  termsUri?: string;
  clientUri?: string;
  contacts?: Array<{ email: string }>;
}

export interface DataRecipient {
  clientId: string;
  clientSecret?: string;
  name?: string;
  scope?: string;
  country?: string;
  redirectUris?: string[];
  [key: string]: unknown;
}

export interface RegistrationStatus {
  clientId: string;
  clientName: string;
  providerId: number;
  providerName: string;
  country: string;
  registrationStatus: 'PENDING_APPROVAL' | 'PENDING_ACTIVATION' | 'ACTIVE' | (string & {});
  requestedOn: string;
}

/**
 * Flinks Open Banking (Outbound) — as a Data Recipient, mint tokens, list Data
 * Providers, manage recipient registrations, and revoke connections. Lives on
 * its own host and uses Bearer auth from `token`.
 */
export class OutboundApi {
  private accessToken?: string;

  constructor(private readonly http: HttpClient, accessToken?: string) {
    this.accessToken = accessToken;
  }

  /** Use a pre-obtained access token as the Bearer for subsequent calls. */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  private bearer() {
    if (!this.accessToken) {
      throw new Error(
        'Outbound: no access token. Call token() or setAccessToken() first.',
      );
    }
    return { type: 'bearer' as const, token: this.accessToken };
  }

  /**
   * Mint an access token and store it for subsequent calls.
   * `authorization_code` also returns a refresh token.
   */
  async token(options: OutboundTokenOptions): Promise<OutboundTokenResponse> {
    const result = await this.http.request<OutboundTokenResponse>({
      method: 'POST',
      path: '/api/v1/token',
      endpoint: 'outboundToken',
      auth: { type: 'none' },
      // This host expects snake_case OAuth fields, not PascalCase.
      body: toSnakeCase(options),
      transformRequest: false,
    });
    this.accessToken = result.accessToken;
    return result;
  }

  /** List active Data Providers, optionally filtered by country. */
  listDataProviders(country?: string): Promise<unknown> {
    return this.http.request({
      method: 'GET',
      path: '/api/v2/providers',
      endpoint: 'listDataProviders',
      auth: this.bearer(),
      query: { country },
    });
  }

  /** Revoke access for an individual connection. Returns nothing (204). */
  revokeConnection(loginId: string, extra: Record<string, unknown> = {}): Promise<void> {
    return this.http.request({
      method: 'DELETE',
      path: '/api/v1/revoke',
      endpoint: 'revokeConnection',
      auth: this.bearer(),
      // The revoke body is BankingServices-style PascalCase (LoginId, ...).
      body: { loginId, mostRecentCached: true, ...extra },
      transformResponse: false,
    });
  }

  /** Add a new Data Recipient. Returns its `clientId` and `clientSecret`. */
  createDataRecipient(options: CreateDataRecipientOptions): Promise<DataRecipient> {
    return this.http.request({
      method: 'POST',
      path: '/api/v1/recipients',
      endpoint: 'createDataRecipient',
      auth: this.bearer(),
      body: toSnakeCase(options),
      transformRequest: false,
    });
  }

  /** Regenerate a Data Recipient's client secret. */
  regenerateSecret(clientId: string): Promise<DataRecipient> {
    return this.http.request({
      method: 'POST',
      path: `/api/v1/recipients/${clientId}/secret`,
      endpoint: 'regenerateSecret',
      auth: this.bearer(),
    });
  }

  /** Update a Data Recipient's redirect URLs. */
  updateDataRecipient(clientId: string, redirectUris: string): Promise<DataRecipient> {
    return this.http.request({
      method: 'PUT',
      path: `/api/v1/recipients/${clientId}`,
      endpoint: 'updateDataRecipient',
      auth: this.bearer(),
      body: { redirect_uris: redirectUris },
      transformRequest: false,
    });
  }

  /** Registration status for one Data Recipient. */
  getRegistrationStatus(clientId: string): Promise<RegistrationStatus[]> {
    return this.http.request({
      method: 'GET',
      path: `/api/v1/recipients/${clientId}/providers/requests`,
      endpoint: 'getRegistrationStatus',
      auth: this.bearer(),
    });
  }

  /** Registration status across all Data Recipients. */
  getAllRegistrationStatuses(): Promise<RegistrationStatus[]> {
    return this.http.request({
      method: 'GET',
      path: '/api/v1/recipients/providers/requests',
      endpoint: 'getAllRegistrationStatuses',
      auth: this.bearer(),
    });
  }

  /** Request that Flinks connect recipients with providers. */
  requestProviderRegistrations(
    recipientIds: string[],
    providerIds: string[],
  ): Promise<unknown> {
    return this.http.request({
      method: 'POST',
      path: `/api/v1/recipients/providers/requests/${recipientIds.join(',')}/${providerIds.join(',')}`,
      endpoint: 'requestProviderRegistrations',
      auth: this.bearer(),
    });
  }
}
