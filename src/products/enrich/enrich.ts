import type { HttpClient } from '../../core/http.js';
import { pathParam } from '../../core/params.js';
import type { FlinksResponseBase } from '../../types/index.js';

/**
 * Attribute payloads are large, use-case-specific, and evolve over time, so
 * they are exposed as an open record keyed by attribute name rather than a
 * frozen interface. The envelope fields you always get are typed.
 */
export interface AttributesResponse extends FlinksResponseBase {
  requestId?: string;
  loginId?: string;
  card?: unknown;
  login?: unknown;
  attributesDetails?: unknown;
  [attribute: string]: unknown;
}

export interface AttributesQuery {
  loginId: string;
  requestId: string;
}

export interface RequestAttributesOptions extends AttributesQuery {
  /** The attributes to compute, broken down by level (`card` is supported). */
  attributes: Record<string, unknown>;
  /** Optional filters, e.g. `{ accountCategory: 'Operations' }`. */
  filters?: Record<string, unknown>;
  /** Optional account filter (requires `filters` to also be set). */
  accountFilter?: Record<string, unknown>;
  /** Return the underlying transactions for Sum/Count attributes. */
  attributesDetail?: Record<string, unknown>;
  /** Restrict the analysis window (1–365 days). */
  limitDays?: number;
}

export interface PrepaymentOptions extends AttributesQuery {
  loanFrequency: 'Weekly' | 'BiWeekly' | 'BiMonthly' | 'Monthly';
  expectedRepaymentTotal: string;
  /** YYYY-MM-DD. */
  fundingDate: string;
  /** Number of payments, as a string integer. */
  duration: string;
}

export interface AttributeLibraryEntry {
  category: string;
  attributes: Array<{ name: string; description: string }>;
}

/**
 * Flinks Enrich — turn raw transactional data into use-case Attributes (income,
 * credit risk, lending, business analysis, payment optimization) plus
 * categorization and the attribute libraries.
 *
 * Call `/Authorize` (and typically `getAccountsDetail`) first to get the
 * `requestId`. Enrich responses are synchronous (200); no async polling.
 */
export class EnrichApi {
  constructor(
    private readonly http: HttpClient,
    private readonly customerBase: string,
  ) {}

  private insight(name: string, { loginId, requestId }: AttributesQuery, endpoint: string) {
    return this.http.request<AttributesResponse>({
      method: 'GET',
      path: `${this.customerBase}/insight/login/${pathParam(loginId, 'loginId')}/attributes/${pathParam(requestId, 'requestId')}/${name}`,
      endpoint,
    });
  }

  // ── Consumer attributes ────────────────────────────────────────────────────

  getIncomeAttributes(query: AttributesQuery): Promise<AttributesResponse> {
    return this.insight('GetIncomeAttributes', query, 'getIncomeAttributes');
  }

  getCreditRiskAttributes(query: AttributesQuery): Promise<AttributesResponse> {
    return this.insight('GetCreditRiskAttributes', query, 'getCreditRiskAttributes');
  }

  getLendingAttributes(query: AttributesQuery): Promise<AttributesResponse> {
    return this.insight('GetLendingAttributes', query, 'getLendingAttributes');
  }

  getUserAnalysisAttributes(query: AttributesQuery): Promise<AttributesResponse> {
    return this.insight('GetUserAnalysisAttributes', query, 'getUserAnalysisAttributes');
  }

  /** Complete attribute set (requires Tier 2+ access). */
  getAllAttributes(query: AttributesQuery): Promise<AttributesResponse> {
    return this.insight('GetAllAttributes', query, 'getAllAttributes');
  }

  // ── Business attributes ─────────────────────────────────────────────────────

  getBusinessAnalysisAttributes(query: AttributesQuery): Promise<AttributesResponse> {
    return this.insight('GetBusinessAnalysisAttributes', query, 'getBusinessAnalysisAttributes');
  }

  /** All business attributes (requires Tier 2+ access). */
  getAllBusinessAttributes(query: AttributesQuery): Promise<AttributesResponse> {
    return this.insight('GetAllBusinessAttributes', query, 'getAllBusinessAttributes');
  }

  // ── Request specific attributes ─────────────────────────────────────────────

  /** Request a specific set of attributes by name. */
  requestAttributes(options: RequestAttributesOptions): Promise<AttributesResponse> {
    const { loginId, requestId, ...body } = options;
    return this.http.request({
      method: 'POST',
      path: `${this.customerBase}/insight/login/${pathParam(loginId, 'loginId')}/attributes/${pathParam(requestId, 'requestId')}`,
      endpoint: 'requestAttributes',
      body,
    });
  }

  // ── Categorization ──────────────────────────────────────────────────────────

  getCategorization({ loginId, requestId }: AttributesQuery): Promise<AttributesResponse> {
    return this.http.request({
      method: 'GET',
      path: `${this.customerBase}/categorization/login/${pathParam(loginId, 'loginId')}/requestid/${pathParam(requestId, 'requestId')}`,
      endpoint: 'getCategorization',
    });
  }

  // ── Payments optimization ───────────────────────────────────────────────────

  /** Cash-flow projection for optimal payment scheduling. */
  prepayment(options: PrepaymentOptions): Promise<AttributesResponse> {
    const { loginId, requestId, ...body } = options;
    return this.http.request({
      method: 'POST',
      path: `${this.customerBase}/prepayment/login/${pathParam(loginId, 'loginId')}/${pathParam(requestId, 'requestId')}`,
      endpoint: 'prepayment',
      body,
    });
  }

  // ── Attribute libraries ─────────────────────────────────────────────────────

  /** List all available consumer attributes. */
  getConsumerLibrary(): Promise<AttributeLibraryEntry[]> {
    return this.http.request({
      method: 'GET',
      path: `${this.customerBase}/attributes/library`,
      endpoint: 'getConsumerLibrary',
    });
  }

  /** List all available business attributes. */
  getBusinessLibrary(): Promise<AttributeLibraryEntry[]> {
    return this.http.request({
      method: 'GET',
      path: `${this.customerBase}/attributes/library/business`,
      endpoint: 'getBusinessLibrary',
    });
  }

  /** Categorization category reference library for a country (e.g. `CA`, `US`). */
  getCategories(countryCode: string): Promise<unknown> {
    return this.http.request({
      method: 'GET',
      path: `${this.customerBase}/BankingServices/Categories/${countryCode}`,
      endpoint: 'getCategories',
    });
  }
}
