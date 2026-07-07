import type { HttpClient } from '../../core/http.js';
import type { FlinksResponseBase } from '../../types/index.js';

/**
 * Attribute payloads are large, use-case-specific, and evolve over time, so
 * they are exposed as an open record keyed by attribute name rather than a
 * frozen interface. The envelope fields you always get are typed.
 */
export interface AttributesResponse extends FlinksResponseBase {
  requestId?: string;
  loginId?: string;
  [attribute: string]: unknown;
}

export interface AttributesQuery {
  loginId: string;
  requestId: string;
}

/**
 * Flinks Enrich — turn raw transactional data into use-case Attributes
 * (income, credit risk, lending, categorization). All reads are GET against the
 * `insight` path and follow the same async 202/`OPERATION_PENDING` pattern as
 * Connect: retry until you get a 200.
 */
export class EnrichApi {
  constructor(
    private readonly http: HttpClient,
    private readonly customerBase: string,
  ) {}

  private get(name: string, { loginId, requestId }: AttributesQuery, endpoint: string) {
    return this.http.request<AttributesResponse>({
      method: 'GET',
      path: `${this.customerBase}/insight/login/${loginId}/attributes/${requestId}/${name}`,
      endpoint,
    });
  }

  getCreditRiskAttributes(query: AttributesQuery): Promise<AttributesResponse> {
    return this.get('GetCreditRiskAttributes', query, 'getCreditRiskAttributes');
  }

  getIncomeAttributes(query: AttributesQuery): Promise<AttributesResponse> {
    return this.get('GetIncomeAttributes', query, 'getIncomeAttributes');
  }

  getLendingAttributes(query: AttributesQuery): Promise<AttributesResponse> {
    return this.get('GetLendingAttributes', query, 'getLendingAttributes');
  }

  getUserAnalysisAttributes(query: AttributesQuery): Promise<AttributesResponse> {
    return this.get('GetUserAnalysisAttributes', query, 'getUserAnalysisAttributes');
  }

  getCategorization(query: AttributesQuery): Promise<AttributesResponse> {
    return this.get('GetCategorization', query, 'getCategorization');
  }

  /** Complete attribute set (requires Tier 2+ access). */
  getAllAttributes(query: AttributesQuery): Promise<AttributesResponse> {
    return this.get('GetAllAttributes', query, 'getAllAttributes');
  }
}
