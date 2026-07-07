import type { HttpClient } from '../../core/http.js';
import { toPascalCase } from '../../core/case.js';
import type { FlinksResponseBase } from '../../types/index.js';

export interface UploadTransaction {
  date: string;
  description: string;
  debit?: number | null;
  credit?: number | null;
  balance?: number | null;
  [key: string]: unknown;
}

export interface UploadOptions {
  /** `ca` or `us`. Sent to Flinks as `Origin Country`. */
  originCountry: 'ca' | 'us';
  transactions: UploadTransaction[];
  /** Attributes / Card definition to compute. */
  card?: Record<string, unknown>;
  mostRecentBalance?: string;
  oldestBalance?: string;
  attributesDetail?: string[];
  options?: string[];
}

export interface UploadCategorizationOptions {
  /** US only. */
  originCountry: 'us';
  transactions: UploadTransaction[];
  userIdentifier?: string;
  options?: Record<string, unknown>;
}

export interface UploadResponse extends FlinksResponseBase {
  requestId?: string;
  card?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface FraudAnalysisResponse extends FlinksResponseBase {
  requestId?: string;
  login?: { loginId: string; requestId: string };
  documentAnalysis?: unknown[];
}

/**
 * Flinks Upload (External Data) — compute Attributes, categorization, and fraud
 * signals from transaction data you supply, without linking a bank. Uses Bearer
 * auth (your API secret).
 */
export class UploadApi {
  constructor(
    private readonly http: HttpClient,
    private readonly customerBase: string,
  ) {}

  /** Upload transactions and receive calculated attributes. */
  upload(options: UploadOptions): Promise<UploadResponse> {
    const { originCountry, ...rest } = options;
    // This endpoint expects the literal key `Origin Country` (with a space),
    // so PascalCase the rest of the body and add that key by hand.
    const body = { 'Origin Country': originCountry, ...toPascalCase<object>(rest) };
    return this.http.request({
      method: 'POST',
      path: `${this.customerBase}/attributes/upload`,
      endpoint: 'upload',
      body,
      transformRequest: false,
    });
  }

  /** Broad categorization from external transactions (US only). */
  categorize(options: UploadCategorizationOptions): Promise<UploadResponse> {
    return this.http.request({
      method: 'POST',
      path: `${this.customerBase}/Categorization/Upload`,
      endpoint: 'uploadCategorization',
      body: options,
    });
  }

  /** Check fraud signals for documents uploaded under a login. */
  fraudAnalysis(loginId: string): Promise<FraudAnalysisResponse> {
    return this.http.request({
      method: 'GET',
      path: `${this.customerBase}/upload/fraudanalysis/${loginId}`,
      endpoint: 'fraudAnalysis',
    });
  }
}
