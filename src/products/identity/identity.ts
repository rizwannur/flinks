import type { HttpClient } from '../../core/http.js';
import type { FlinksResponseBase } from '../../types/index.js';

export interface FieldMatchOptions {
  /** The LoginId of a connection that has completed GetAccountsDetail. */
  loginId?: string;
  fullName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  postalCode?: string;
  civicAddress?: string;
  city?: string;
  province?: string;
  email?: string;
  phone?: string;
  /** Minimum match rate (0–1). When set, a boolean `overallMatch` is returned. */
  threshold?: string;
}

export interface FieldLevelMatch {
  fullName?: boolean;
  phone?: boolean;
  email?: boolean | null;
  civicAddress?: boolean;
  city?: boolean;
  province?: boolean;
  postalCode?: boolean;
  noData?: string[];
}

export interface FieldLevelMatchRate {
  fullName?: number;
  phone?: number;
  email?: number | null;
  civicAddress?: number;
  city?: number;
  province?: number;
  postalCode?: number;
  noData?: string[];
}

export interface FieldMatchResponse extends FlinksResponseBase {
  /** Present only when a `threshold` was supplied. */
  overallMatch?: boolean;
  fieldLevelMatch?: FieldLevelMatch;
  overallMatchRate?: number;
  fieldLevelMatchRate?: FieldLevelMatchRate;
}

/**
 * Flinks Identity — verify that details you hold about a user (name, address,
 * email, phone) match the bank-verified data on a linked connection. Requires a
 * `loginId` that has already completed `getAccountsDetail`.
 */
export class IdentityApi {
  constructor(
    private readonly http: HttpClient,
    private readonly basePath: string,
  ) {}

  /** Fuzzy-match supplied fields against bank-verified identity data. */
  fieldMatch(options: FieldMatchOptions): Promise<FieldMatchResponse> {
    return this.http.request({
      method: 'POST',
      path: `${this.basePath}/FieldMatch`,
      endpoint: 'fieldMatch',
      body: options,
    });
  }
}
