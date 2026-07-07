import { HttpClient, type AuthScheme } from './core/http.js';
import { AuthorizeApi } from './products/authorize/authorize.js';
import { ConnectApi } from './products/connect/connect.js';
import { EnrichApi } from './products/enrich/enrich.js';
import { UploadApi } from './products/upload/upload.js';
import { UtilitiesApi } from './products/utilities/utilities.js';
import { PayApi } from './products/pay/pay.js';
import { OutboundApi } from './products/outbound/outbound.js';
import type { FlinksConfig, FlinksHosts } from './types/index.js';

const defaultHosts = (instance: string): FlinksHosts => ({
  banking: `https://${instance}-api.private.fin.ag`,
  pay: 'https://www.flinks.com',
  outbound: 'https://ob.flinksapp.com',
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

  constructor(config: FlinksConfig) {
    const hosts = { ...defaultHosts(config.instance), ...config.hosts };
    const customerBase = `/v3/${config.customerId}`;
    const bankingBase = `${customerBase}/BankingServices`;

    const shared = {
      timeoutMs: config.timeoutMs,
      maxRetries: config.maxRetries,
      fetch: config.fetch,
    };

    const keyAuth: AuthScheme = { type: 'flinks-auth-key', token: config.apiSecret ?? '' };
    const bearerAuth: AuthScheme = { type: 'bearer', token: config.apiSecret ?? '' };

    // BankingServices + Enrich authenticate with the `flinks-auth-key` header.
    const bankingKey = new HttpClient({ baseUrl: hosts.banking, auth: keyAuth, ...shared });
    // Upload + data-sharing utilities authenticate with a Bearer token.
    const bankingBearer = new HttpClient({ baseUrl: hosts.banking, auth: bearerAuth, ...shared });
    // Pay and Outbound are token-minting hosts — no default auth.
    const pay = new HttpClient({ baseUrl: hosts.pay, auth: { type: 'none' }, ...shared });
    const outbound = new HttpClient({ baseUrl: hosts.outbound, auth: { type: 'none' }, ...shared });

    this.authorize = new AuthorizeApi(bankingKey, bankingBase);
    this.connect = new ConnectApi(bankingKey, bankingBase);
    this.enrich = new EnrichApi(bankingKey, customerBase);
    this.upload = new UploadApi(bankingBearer, customerBase);
    this.utilities = new UtilitiesApi(bankingBearer, customerBase);
    this.pay = new PayApi(pay);
    this.outbound = new OutboundApi(outbound);
  }
}
