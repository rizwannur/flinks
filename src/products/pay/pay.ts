import type { HttpClient } from '../../core/http.js';

// ── Auth ─────────────────────────────────────────────────────────────────────

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

// ── V2 sessions (e-Transfer, EFT, GEFT) ──────────────────────────────────────

export interface PartyAddress {
  addressLine1?: string;
  city?: string;
  postalCode?: string;
  province?: string;
  country?: string;
}

export interface PartyInfo {
  firstName?: string;
  lastName?: string;
  email?: string;
  address?: PartyAddress;
}

export interface SessionOptions {
  guarantee?: { enable: boolean };
  notificationPreferences?: { language?: string };
  showConsentScreen?: boolean;
}

export interface InitiateSessionOptions {
  type: 'EFT' | 'e-Transfer';
  /** Defaults to `DEBIT` in the session helpers. */
  direction?: 'DEBIT' | 'CREDIT';
  currency?: 'CAD';
  /** Optional — if omitted, the user enters it in the hosted flow. */
  amount?: number;
  referenceId?: string;
  payor?: PartyInfo;
  payee?: PartyInfo | null;
  options?: SessionOptions;
}

export interface InitiateSessionResponse {
  sessionId: string;
  referenceId?: string;
}

export interface SessionDetails {
  sessionId: string;
  referenceId?: string;
  type?: string;
  status?: string;
  statusDetails?: unknown;
  amount?: number;
  [key: string]: unknown;
}

// ── V1 EFT (legacy, x-client-id) ─────────────────────────────────────────────

export interface EftScheduleInfo {
  paymentFrequency: 'OneTime' | 'Weekly' | 'Biweekly' | 'Monthly';
  startDate: string;
  endDate?: string;
  transactionsCount?: number;
}

export interface CreateEftTransaction {
  transactionCode: number;
  amount: number;
  paymentDirection: 'DEBIT' | 'CREDIT';
  currency: 'CAD';
  scheduleInfo: EftScheduleInfo;
  description?: string;
  crossReferenceNumber?: string;
  purposeCategory?: string;
  payor?: Record<string, unknown>;
  payee?: Record<string, unknown>;
}

/**
 * Flinks Pay — Interac e-Transfer and EFT payments. Lives on its own host.
 *
 * Modern flow (recommended): call {@link authorize} once to mint a session
 * token, then use the V2 session helpers — {@link createETransferSession},
 * {@link createEftSession}, {@link createGuaranteedEftSession} — which all
 * resolve to the shared `/api/v2/sessions` resource. Legacy V1 EFT
 * (`x-client-id`) is also available via {@link createEftTransactionV1} etc.
 */
export class PayApi {
  private accessToken?: string;
  private clientId?: string;

  constructor(private readonly http: HttpClient, options?: { clientId?: string }) {
    this.clientId = options?.clientId;
  }

  /** Reuse a token obtained elsewhere. */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /** Set the `x-client-id` API key used by the legacy V1 EFT endpoints. */
  setClientId(clientId: string): void {
    this.clientId = clientId;
  }

  private bearer() {
    if (!this.accessToken) {
      throw new Error('Pay: no access token. Call authorize() or setAccessToken() first.');
    }
    return { type: 'bearer' as const, token: this.accessToken };
  }

  private clientHeaders(): Record<string, string> {
    if (!this.clientId) {
      throw new Error('Pay V1 EFT: no clientId. Pass { clientId } or call setClientId().');
    }
    return { 'x-client-id': this.clientId };
  }

  /**
   * Mint a Flinks Pay session token and store it. Credentials are form-encoded;
   * the returned `accessToken` is single-use — call this again per session.
   */
  async authorize(options: PayAuthorizeOptions): Promise<PayAuthorizeResponse> {
    const result = await this.http.request<PayAuthorizeResponse>({
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
    this.accessToken = result.accessToken;
    return result;
  }

  // ── V2 sessions ─────────────────────────────────────────────────────────────

  /** Create a payment session (the low-level shared endpoint). */
  createSession(options: InitiateSessionOptions): Promise<InitiateSessionResponse> {
    return this.http.request({
      method: 'POST',
      path: '/api/v2/sessions',
      endpoint: 'createSession',
      auth: this.bearer(),
      body: options,
      transformRequest: false, // Pay speaks camelCase JSON, not PascalCase
    });
  }

  /** Create an Interac e-Transfer (Request Money) session. */
  createETransferSession(
    options: Omit<InitiateSessionOptions, 'type'>,
  ): Promise<InitiateSessionResponse> {
    return this.createSession({
      ...options,
      type: 'e-Transfer',
      direction: options.direction ?? 'DEBIT',
      currency: options.currency ?? 'CAD',
    });
  }

  /** Create a regular EFT (Pre-Authorized Debit) session. */
  createEftSession(
    options: Omit<InitiateSessionOptions, 'type'>,
  ): Promise<InitiateSessionResponse> {
    return this.createSession({
      ...options,
      type: 'EFT',
      direction: options.direction ?? 'DEBIT',
      currency: options.currency ?? 'CAD',
      options: { ...options.options, guarantee: { enable: false } },
    });
  }

  /** Create a Guaranteed EFT (GEFT) session. */
  createGuaranteedEftSession(
    options: Omit<InitiateSessionOptions, 'type'>,
  ): Promise<InitiateSessionResponse> {
    return this.createSession({
      ...options,
      type: 'EFT',
      direction: options.direction ?? 'DEBIT',
      currency: options.currency ?? 'CAD',
      options: { ...options.options, guarantee: { enable: true } },
    });
  }

  /** Retrieve full session information and status. */
  getSessionDetails(sessionId: string): Promise<SessionDetails> {
    return this.http.request({
      method: 'GET',
      path: `/api/v2/sessions/${sessionId}/details`,
      endpoint: 'getSessionDetails',
      auth: this.bearer(),
    });
  }

  /** Terminate an active session. */
  cancelSession(sessionId: string): Promise<unknown> {
    return this.http.request({
      method: 'POST',
      path: `/api/v2/sessions/${sessionId}/cancel`,
      endpoint: 'cancelSession',
      auth: this.bearer(),
    });
  }

  /** Accept or reject a GEFT guarantee (used with the webhook flow). */
  confirmGuarantee(sessionId: string, guaranteeAccepted: boolean): Promise<InitiateSessionResponse> {
    return this.http.request({
      method: 'POST',
      path: `/api/v2/sessions/${sessionId}/guarantees/confirm`,
      endpoint: 'confirmGuarantee',
      auth: this.bearer(),
      body: { guaranteeAccepted },
      transformRequest: false,
    });
  }

  // ── V1 EFT (legacy) ─────────────────────────────────────────────────────────

  /** Create a legacy V1 EFT transaction. Authenticated with `x-client-id`. */
  createEftTransactionV1(transaction: CreateEftTransaction): Promise<unknown> {
    return this.http.request({
      method: 'POST',
      path: '/api/v1/transactions',
      endpoint: 'createEftTransactionV1',
      auth: { type: 'none' },
      headers: this.clientHeaders(),
      body: [transaction], // the endpoint expects an array of exactly one
      transformRequest: false, // Pay speaks camelCase JSON, not PascalCase
    });
  }

  getSchedule(scheduleId: string): Promise<unknown> {
    return this.http.request({
      method: 'GET',
      path: `/api/v1/schedules/${scheduleId}`,
      endpoint: 'getSchedule',
      auth: { type: 'none' },
      headers: this.clientHeaders(),
    });
  }

  cancelSchedule(scheduleId: string): Promise<unknown> {
    return this.http.request({
      method: 'POST',
      path: `/api/v1/schedules/${scheduleId}/cancel`,
      endpoint: 'cancelSchedule',
      auth: { type: 'none' },
      headers: this.clientHeaders(),
    });
  }

  getContact(contactId: string): Promise<unknown> {
    return this.http.request({
      method: 'GET',
      path: `/api/v1/contacts/${contactId}`,
      endpoint: 'getContact',
      auth: { type: 'none' },
      headers: this.clientHeaders(),
    });
  }

  /** Get a PAD agreement, including the `padLink` to present for signing. */
  getPadAgreement(padId: string): Promise<unknown> {
    return this.http.request({
      method: 'GET',
      path: `/api/v1/pads/${padId}`,
      endpoint: 'getPadAgreement',
      auth: { type: 'none' },
      headers: this.clientHeaders(),
    });
  }
}
