import type { HttpClient } from '../../core/http.js';
import type { FlinksResponseBase } from '../../types/index.js';

export interface AuthSecretResponse extends FlinksResponseBase {
  requestId?: string;
  /** Save this — it's required to later revoke the grant. */
  permissionId?: string;
  /** The token the partner uses to access Flinks APIs on your behalf. */
  authSecret?: string;
}

/**
 * Flinks data-sharing utilities — grant and revoke partner access to data that
 * Flinks processes on your behalf. Uses Bearer auth (your API secret).
 */
export class UtilitiesApi {
  constructor(
    private readonly http: HttpClient,
    private readonly customerBase: string,
  ) {}

  /** Grant a partner access to your Flinks-processed data. */
  grantAuthSecret(partnerName: string): Promise<AuthSecretResponse> {
    return this.http.request({
      method: 'GET',
      path: `${this.customerBase}/partnerdata/authsecret/${partnerName}`,
      endpoint: 'grantAuthSecret',
    });
  }

  /** Revoke a previously granted partner access, by its PermissionId. */
  disableAuthSecret(permissionId: string): Promise<AuthSecretResponse> {
    return this.http.request({
      method: 'GET',
      path: `${this.customerBase}/partnerdata/authsecret/disable/${permissionId}`,
      endpoint: 'disableAuthSecret',
    });
  }

  /** Re-enable a previously disabled partner access, by its PermissionId. */
  enableAuthSecret(permissionId: string): Promise<AuthSecretResponse> {
    return this.http.request({
      method: 'GET',
      path: `${this.customerBase}/partnerdata/authsecret/enable/${permissionId}`,
      endpoint: 'enableAuthSecret',
    });
  }
}
