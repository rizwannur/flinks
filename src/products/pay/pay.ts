import type { HttpClient } from '../../core/http.js';
import { pathParam } from '../../core/params.js';

/**
 * Flinks Pay — Interac e-Transfer and EFT payments.
 *
 * @experimental Flinks Pay runs on a **client-provisioned host** that is not
 * publicly documented (the OpenAPI spec redacts it as `www.{baseurl}.com`, and
 * it is delivered to you at onboarding). You MUST supply it via
 * `new FlinksClient({ hosts: { pay: 'https://…' } })` — there is no usable
 * default. These methods follow the published Pay OpenAPI spec
 * (https://docs.flinks.com/openapi-pay.yaml) but could not be verified against a
 * live sandbox, so treat the shapes as best-effort until you confirm against
 * your provisioned instance.
 *
 * Flow: {@link authorize} → {@link initiateSession} → {@link createPaymentRequest}
 * → poll {@link getPaymentRequest}.
 */

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface PayAuthorizeOptions {
  username: string;
  password: string;
  /** OAuth grant type. Default `client_credentials`. */
  grantType?: string;
}

export interface PayAuthorizeResponse {
  accessToken: string;
  tokenType?: string;
  /** Lifetime in seconds. */
  expiresIn?: number;
}

// ── Sessions ─────────────────────────────────────────────────────────────────

export interface InitiateSessionOptions {
  /** Your correlation id, echoed back on the session and webhooks. */
  referenceId: string;
  /** Amount as a string per the Pay spec (e.g. `"12.50"`). */
  amount: string;
  customerName: string;
  customerEmail: string;
  /** Redirect URLs the hosted flow returns to. */
  clientURIs?: Record<string, string>;
}

export interface InitiateSessionResponse {
  sessionId: string;
  referenceId?: string;
}

// ── Payment requests ─────────────────────────────────────────────────────────

export interface PaymentRequestResponse {
  requestId: string;
  [key: string]: unknown;
}

export interface PaymentRequestStatus {
  requestId: string;
  status?: string;
  [key: string]: unknown;
}

export class PayApi {
  private accessToken?: string;

  constructor(private readonly http: HttpClient) {}

  /** Reuse a token obtained elsewhere. */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  // Pay data calls carry the access token in a `BearerToken` header (not the
  // standard `Authorization: Bearer`), per the Pay OpenAPI spec.
  private authHeaders(): Record<string, string> {
    if (!this.accessToken) {
      throw new Error('Pay: no access token. Call authorize() or setAccessToken() first.');
    }
    return { BearerToken: this.accessToken };
  }

  /**
   * Mint a Flinks Pay access token and store it. Credentials are form-encoded.
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

  /** Initiate a payment session. Returns the `sessionId` used downstream. */
  initiateSession(options: InitiateSessionOptions): Promise<InitiateSessionResponse> {
    return this.http.request({
      method: 'POST',
      path: '/api/v1/sessions/initiate',
      endpoint: 'payInitiateSession',
      auth: { type: 'none' },
      headers: this.authHeaders(),
      body: options,
      transformRequest: false, // Pay speaks camelCase JSON, not PascalCase
    });
  }

  /** Send the payment request to the customer for an initiated session. */
  sendSessionRequest(sessionId: string): Promise<unknown> {
    return this.http.request({
      method: 'POST',
      path: '/api/v1/sessions/sendrequest',
      endpoint: 'paySendSessionRequest',
      auth: { type: 'none' },
      headers: this.authHeaders(),
      body: { sessionId },
      transformRequest: false,
    });
  }

  /** Activate a session into a payment request. Returns the `requestId`. */
  createPaymentRequest(sessionId: string): Promise<PaymentRequestResponse> {
    return this.http.request({
      method: 'POST',
      path: '/api/v1/paymentrequests',
      endpoint: 'payCreatePaymentRequest',
      auth: { type: 'none' },
      headers: this.authHeaders(),
      body: { sessionId },
      transformRequest: false,
    });
  }

  /** Poll a payment request by id for its current status. */
  getPaymentRequest(requestId: string): Promise<PaymentRequestStatus> {
    return this.http.request({
      method: 'GET',
      path: `/api/v1/paymentrequests/${pathParam(requestId, 'requestId')}`,
      endpoint: 'payGetPaymentRequest',
      auth: { type: 'none' },
      headers: this.authHeaders(),
    });
  }
}
