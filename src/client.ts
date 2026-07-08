import { HttpClient, type AuthScheme } from './core/http.js';
import { AuthorizeApi } from './products/authorize/authorize.js';
import { ConnectApi } from './products/connect/connect.js';
import { EnrichApi } from './products/enrich/enrich.js';
import { UploadApi } from './products/upload/upload.js';
import { UtilitiesApi } from './products/utilities/utilities.js';
import { PayApi } from './products/pay/pay.js';
import { OutboundApi } from './products/outbound/outbound.js';
import { IdentityApi } from './products/identity/identity.js';
import { WealthApi } from './products/wealth/wealth.js';
import {
  handleFlinksWebhook,
  parseFlinksWebhook,
  type FlinksWebhookEvent,
} from './core/webhooks.js';
import type { PollOptions } from './core/poll.js';
import type { AuthorizeOptions, SecurityChallenge } from './products/authorize/types.js';
import type {
  Account,
  AccountsResponse,
  GetAccountsDetailOptions,
  GetAccountsSummaryOptions,
} from './products/connect/types.js';
import type { FlinksConfig, FlinksHosts } from './types/index.js';

/** MFA is required — answer the challenges to continue the same flow. */
export interface AccountsMfaRequired {
  status: 'mfa';
  requestId: string;
  challenges: SecurityChallenge[];
  /** Submit answers (keyed by challenge prompt) and continue. */
  answer(responses: Record<string, string[]>): Promise<AccountsResult>;
}

/** The flow completed — accounts are ready. */
export interface AccountsReady {
  status: 'done';
  requestId: string;
  accounts: Account[];
  /** The full underlying response, if you need more than `accounts`. */
  raw: AccountsResponse;
}

export type AccountsResult = AccountsReady | AccountsMfaRequired;

export interface GetAccountsFlowOptions {
  /** Extra GetAccountsDetail flags (transactions, KYC, filters, …). */
  detail?: Omit<GetAccountsDetailOptions, 'requestId'>;
  /** Extra GetAccountsSummary flags. */
  summary?: Omit<GetAccountsSummaryOptions, 'requestId'>;
  /** Polling cadence for the async wait. */
  poll?: PollOptions;
}

const defaultHosts = (instance: string): FlinksHosts => ({
  banking: `https://${instance}-api.private.fin.ag`,
  // Flinks Pay runs on a client-provisioned host delivered at onboarding; there
  // is no public default. Supply it via `hosts.pay` before using `flinks.pay`.
  pay: '',
  outbound: 'https://ob.flinksapp.com',
  wealth: `https://${instance}-wealth-api.private.fin.ag`,
});

/**
 * The Flinks API client.
 *
 * One client, one config, seven product namespaces:
 *
 * ```ts
 * const flinks = new FlinksClient({ instance: 'toolbox', customerId, apiSecret });
 * const { requestId } = await flinks.authorize.authorize({ loginId });
 * const detail = await flinks.connect.getAccountsDetail({ requestId });
 * ```
 */
export class FlinksClient {
  readonly authorize: AuthorizeApi;
  readonly connect: ConnectApi;
  readonly enrich: EnrichApi;
  readonly upload: UploadApi;
  readonly utilities: UtilitiesApi;
  readonly pay: PayApi;
  readonly outbound: OutboundApi;
  readonly identity: IdentityApi;
  /** @deprecated Investments retires 2026-04-30. */
  readonly wealth: WealthApi;
  /**
   * Verify and parse inbound Flinks webhooks. `handle` uses the `hmacSecret`
   * from your client config; `parse` skips verification.
   */
  readonly webhooks: {
    /** Verify the HMAC signature and return the typed event. Throws on a bad/missing signature. */
    handle(rawBody: string, headers: Headers | Record<string, string | string[] | undefined>): FlinksWebhookEvent;
    /** Parse a raw body into a typed event without verifying the signature. */
    parse(rawBody: string): FlinksWebhookEvent;
  };

  constructor(config: FlinksConfig) {
    const hosts = { ...defaultHosts(config.instance), ...config.hosts };
    const customerBase = `/v3/${config.customerId}`;
    const bankingBase = `${customerBase}/BankingServices`;

    const shared = {
      timeoutMs: config.timeoutMs,
      maxRetries: config.maxRetries,
      fetch: config.fetch,
    };

    const secretKey = config.secretKey ?? config.apiSecret;
    // Data endpoints authenticate with the `x-api-key` header.
    const dataAuth: AuthScheme = { type: 'x-api-key', token: config.xApiKey ?? '' };

    // One host for all BankingServices/Enrich/Upload/Utilities traffic. Authorize
    // overrides the auth header per call (secret key / authorize token).
    const banking = new HttpClient({ baseUrl: hosts.banking, auth: dataAuth, ...shared });
    // Pay and Outbound are token-minting hosts — no default auth. Pay's host is
    // provisioned per client; a placeholder keeps URL construction valid and
    // produces a clear error rather than a cryptic one when it's left unset.
    const pay = new HttpClient({
      baseUrl: hosts.pay || 'https://pay-host-not-configured.invalid',
      auth: { type: 'none' },
      ...shared,
    });
    const outbound = new HttpClient({ baseUrl: hosts.outbound, auth: { type: 'none' }, ...shared });
    const wealth = new HttpClient({ baseUrl: hosts.wealth, auth: dataAuth, ...shared });

    this.authorize = new AuthorizeApi(banking, bankingBase, secretKey, config.authorizeToken);
    this.connect = new ConnectApi(banking, bankingBase);
    this.enrich = new EnrichApi(banking, customerBase);
    this.upload = new UploadApi(banking, customerBase);
    this.utilities = new UtilitiesApi(banking, customerBase);
    this.identity = new IdentityApi(banking, bankingBase);
    this.pay = new PayApi(pay);
    this.outbound = new OutboundApi(outbound);
    this.wealth = new WealthApi(wealth, customerBase);

    const hmacSecret = config.hmacSecret;
    this.webhooks = {
      handle: (rawBody, headers) => {
        if (!hmacSecret) {
          throw new Error(
            'FlinksClient.webhooks.handle needs `hmacSecret` in the client config. ' +
              'Pass it, or call the standalone handleFlinksWebhook(raw, headers, secret).',
          );
        }
        return handleFlinksWebhook(rawBody, headers, hmacSecret);
      },
      parse: parseFlinksWebhook,
    };
  }

  /**
   * The whole account-aggregation flow in one call: authorize → (MFA) → poll →
   * full account details. Handles the token, the 202 wait, and the 203 MFA
   * branch for you.
   *
   * ```ts
   * let res = await flinks.getAccountDetails({ loginId });
   * while (res.status === 'mfa') {
   *   const answers = await askUser(res.challenges); // { [prompt]: [answer] }
   *   res = await res.answer(answers);
   * }
   * console.log(res.accounts);
   * ```
   */
  getAccountDetails(
    input: AuthorizeOptions,
    options: GetAccountsFlowOptions = {},
  ): Promise<AccountsResult> {
    return this.runAccountsFlow('detail', input, options);
  }

  /** Same one-call flow as {@link getAccountDetails}, but the lighter summary. */
  getAccountSummary(
    input: AuthorizeOptions,
    options: GetAccountsFlowOptions = {},
  ): Promise<AccountsResult> {
    return this.runAccountsFlow('summary', input, options);
  }

  private async runAccountsFlow(
    mode: 'detail' | 'summary',
    input: AuthorizeOptions,
    options: GetAccountsFlowOptions,
  ): Promise<AccountsResult> {
    const auth = await this.authorize.authorize(input);

    if (auth.httpStatusCode === 203) {
      return {
        status: 'mfa',
        requestId: auth.requestId,
        challenges: auth.securityChallenges ?? [],
        answer: (responses) =>
          this.runAccountsFlow(
            mode,
            { requestId: auth.requestId, securityResponses: responses },
            options,
          ),
      };
    }

    const raw =
      mode === 'detail'
        ? await this.connect.getAccountsDetailAndWait(
            { requestId: auth.requestId, ...options.detail },
            options.poll,
          )
        : await this.connect.getAccountsSummaryAndWait(
            { requestId: auth.requestId, ...options.summary },
            options.poll,
          );

    return { status: 'done', requestId: auth.requestId, accounts: raw.accounts ?? [], raw };
  }
}
