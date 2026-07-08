import type { HttpClient } from '../../core/http.js';
import { pathParam } from '../../core/params.js';
import { poll, isPending, type PollOptions } from '../../core/poll.js';
import type {
  AccountsResponse,
  AnswerMfaQuestionsOptions,
  GetAccountsDetailOptions,
  GetAccountsSummaryOptions,
  GetStatementsOptions,
  InstitutionsResponse,
  MfaQuestionsResponse,
  NightlyRefreshStatusResponse,
  RoutingNumberResponse,
  SetScheduledRefreshOptions,
  SimpleResponse,
  StatementsResponse,
} from './types.js';

/**
 * Flinks Connect — retrieve account summaries, full account details,
 * transactions, and PDF statements, plus MFA, card, institution, and nightly
 * refresh management.
 *
 * The summary / detail / statements endpoints are asynchronous: a first call
 * may return `httpStatusCode: 202` with a `requestId`, which you then poll on
 * the matching `*Async` method until it returns `200`.
 */
export class ConnectApi {
  constructor(
    private readonly http: HttpClient,
    private readonly basePath: string,
  ) {}

  getAccountsSummary(options: GetAccountsSummaryOptions): Promise<AccountsResponse> {
    return this.http.request({
      method: 'POST',
      path: `${this.basePath}/GetAccountsSummary`,
      endpoint: 'getAccountsSummary',
      body: options,
    });
  }

  getAccountsSummaryAsync(requestId: string): Promise<AccountsResponse> {
    return this.http.request({
      method: 'GET',
      path: `${this.basePath}/GetAccountsSummaryAsync/${pathParam(requestId, 'requestId')}`,
      endpoint: 'getAccountsSummaryAsync',
    });
  }

  /**
   * Get account summaries and, if Flinks answers `202`, poll until the data is
   * ready — the full async flow in a single call.
   */
  async getAccountsSummaryAndWait(
    options: GetAccountsSummaryOptions,
    pollOptions?: PollOptions,
  ): Promise<AccountsResponse> {
    const first = await this.getAccountsSummary(options);
    if (!isPending(first)) return first;
    return poll(() => this.getAccountsSummaryAsync(options.requestId), pollOptions);
  }

  getAccountsDetail(options: GetAccountsDetailOptions): Promise<AccountsResponse> {
    return this.http.request({
      method: 'POST',
      path: `${this.basePath}/GetAccountsDetail`,
      endpoint: 'getAccountsDetail',
      body: options,
    });
  }

  getAccountsDetailAsync(requestId: string): Promise<AccountsResponse> {
    return this.http.request({
      method: 'GET',
      path: `${this.basePath}/GetAccountsDetailAsync/${pathParam(requestId, 'requestId')}`,
      endpoint: 'getAccountsDetailAsync',
      headers: { Accept: 'application/json' },
    });
  }

  /**
   * Get full account details and, if Flinks answers `202`, poll until the data
   * is ready — the full async flow in a single call.
   */
  async getAccountsDetailAndWait(
    options: GetAccountsDetailOptions,
    pollOptions?: PollOptions,
  ): Promise<AccountsResponse> {
    const first = await this.getAccountsDetail(options);
    if (!isPending(first)) return first;
    return poll(() => this.getAccountsDetailAsync(options.requestId), pollOptions);
  }

  getStatements(options: GetStatementsOptions): Promise<StatementsResponse> {
    return this.http.request({
      method: 'POST',
      path: `${this.basePath}/GetStatements`,
      endpoint: 'getStatements',
      body: options,
    });
  }

  getMfaQuestions(loginId: string): Promise<MfaQuestionsResponse> {
    return this.http.request({
      method: 'GET',
      path: `${this.basePath}/GetMFAQuestions/${pathParam(loginId, 'loginId')}`,
      endpoint: 'getMfaQuestions',
    });
  }

  answerMfaQuestions(options: AnswerMfaQuestionsOptions): Promise<SimpleResponse> {
    return this.http.request({
      method: 'PATCH',
      path: `${this.basePath}/AnswerMFAQuestions`,
      endpoint: 'answerMfaQuestions',
      body: options,
    });
  }

  deleteCard(loginId: string): Promise<SimpleResponse> {
    return this.http.request({
      method: 'DELETE',
      path: `${this.basePath}/DeleteCard/${pathParam(loginId, 'loginId')}`,
      endpoint: 'deleteCard',
    });
  }

  getInstitutions(): Promise<InstitutionsResponse> {
    return this.http.request({
      method: 'GET',
      path: `${this.basePath}/Institutions`,
      endpoint: 'getInstitutions',
    });
  }

  getInstitutionByRoutingNumber(routingNumber: string): Promise<RoutingNumberResponse> {
    return this.http.request({
      method: 'GET',
      path: `${this.basePath}/Institutions/RoutingNumber/${pathParam(routingNumber, 'routingNumber')}`,
      endpoint: 'getInstitutionByRoutingNumber',
    });
  }

  setScheduledRefresh(options: SetScheduledRefreshOptions): Promise<SimpleResponse> {
    return this.http.request({
      method: 'PATCH',
      path: `${this.basePath}/SetScheduledRefresh`,
      endpoint: 'setScheduledRefresh',
      body: options,
    });
  }

  getNightlyRefreshStatus(): Promise<NightlyRefreshStatusResponse> {
    return this.http.request({
      method: 'GET',
      path: `${this.basePath}/GetNightlyRefreshStatus`,
      endpoint: 'getNightlyRefreshStatus',
    });
  }
}
