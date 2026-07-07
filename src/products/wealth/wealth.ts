import type { HttpClient } from '../../core/http.js';
import type { FlinksResponseBase } from '../../types/index.js';

export interface GetInvestmentsOptions {
  loginId?: string;
  requestId?: string;
  /** Must be the string `'true'` for the cached flow. */
  mostRecentCached?: 'true';
}

export interface InvestmentsResponse extends FlinksResponseBase {
  investments?: unknown[];
}

/**
 * Flinks Wealth (Investments).
 *
 * @deprecated Flinks is retiring the Investments product on 2026-04-30. New
 * integrations are unsupported and existing ones stop working after that date.
 * Runs on a separate `*-wealth-api` host.
 */
export class WealthApi {
  constructor(
    private readonly http: HttpClient,
    private readonly customerBase: string,
  ) {}

  /** Retrieve investment accounts, positions, and transactions. */
  getInvestments(options: GetInvestmentsOptions = {}): Promise<InvestmentsResponse> {
    return this.http.request({
      method: 'POST',
      path: `${this.customerBase}/Investments`,
      endpoint: 'getInvestments',
      body: options,
    });
  }

  /** Delete a customer's investments AND banking data for a login. */
  deleteInvestments(loginId: string): Promise<FlinksResponseBase> {
    return this.http.request({
      method: 'DELETE',
      path: `${this.customerBase}/Investments/Delete/${loginId}`,
      endpoint: 'deleteInvestments',
    });
  }
}
