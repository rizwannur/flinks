import type { FlinksResponseBase, Login } from '../../types/index.js';

// ── Request options ──────────────────────────────────────────────────────────

export interface GetAccountsSummaryOptions {
  requestId: string;
  withBalance?: boolean;
  withAccountIdentity?: boolean;
}

export interface GetAccountsDetailOptions {
  requestId: string;
  withAccountIdentity?: boolean;
  withKyc?: boolean;
  withTransactions?: boolean;
  accountsFilter?: string[];
  daysOfTransactions?: string;
  withDetailsAndBankingStatements?: boolean;
  numberOfBankingStatements?: string;
}

export interface GetStatementsOptions {
  requestId: string;
  /** e.g. `"MostRecent"`. */
  numberOfStatements?: string;
  accountsFilter?: string[];
}

export interface AnswerMfaQuestionsOptions {
  loginId: string;
  questions: Array<Record<string, unknown>>;
}

export interface SetScheduledRefreshOptions {
  loginId: string;
  isActivated: boolean;
}

// ── Response shapes ──────────────────────────────────────────────────────────

export interface Balance {
  available: number | null;
  current: number;
  limit: number | null;
}

export interface Transaction {
  id: string;
  date: string;
  code: string | null;
  description: string;
  debit: number | null;
  credit: number | null;
  balance: number;
}

export interface Address {
  civicAddress: string;
  city: string;
  province: string;
  postalCode: string;
  poBox: string | null;
  country: string;
}

export interface Holder {
  name: string;
  address: Address;
  email: string;
  phoneNumber: string;
}

export interface Account {
  id: string;
  title: string;
  accountNumber: string;
  transitNumber: string;
  institutionNumber: string;
  overdraftLimit: number;
  category: string;
  type: string;
  currency: string;
  balance: Balance;
  holder?: Holder;
  transactions?: Transaction[];
  eftEligibleRatio?: number;
}

export interface AccountsResponse extends FlinksResponseBase {
  requestId: string;
  accounts?: Account[];
  login?: Login;
  institution?: string;
  institutionId?: number;
  institutionName?: string;
  tag?: string;
}

export interface Statement {
  uniqueId: string;
  fileType: string;
  base64Bytes: string;
}

export interface StatementsResponse extends FlinksResponseBase {
  requestId: string;
  statementsByAccount?: Array<{ accountNumber: string; statements: Statement[] }>;
  login?: Login;
}

export interface MfaQuestionsResponse extends FlinksResponseBase {
  questions?: Array<Record<string, unknown>>;
}

export interface SimpleResponse extends FlinksResponseBase {
  statusCode?: number;
}

export interface Institution {
  [key: string]: unknown;
}

export interface InstitutionsResponse {
  data: Institution[];
  count: number;
}

export interface RoutingNumberResponse extends FlinksResponseBase {
  id?: number;
  localizations?: unknown;
  status?: string;
  country?: string;
  routingNumbers?: unknown;
}

export interface NightlyRefreshStatusResponse extends FlinksResponseBase {
  ineligibleCards?: unknown[];
}
