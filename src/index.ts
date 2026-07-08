/**
 * flinks — a modern, fully-typed Flinks API client for Node.js and Bun.
 */

export { FlinksClient } from './client.js';
export { FlinksClient as default } from './client.js';
export type {
  AccountsResult,
  AccountsReady,
  AccountsMfaRequired,
  GetAccountsFlowOptions,
} from './client.js';

// Errors & codes
export { FlinksError, type FlinksErrorBody } from './core/errors.js';
export { flinksCodeDescriptions } from './core/flinks-codes.js';

// Webhooks — verify inbound callbacks (Flinks has no registration API; you
// enable webhooks via a Support ticket, then verify + parse deliveries here).
export {
  isWebhookValid,
  signMessage,
  verifyFlinksWebhook,
  FLINKS_WEBHOOK_SIGNATURE_HEADER,
} from './core/authenticity.js';
export {
  handleFlinksWebhook,
  parseFlinksWebhook,
  WebhookVerificationError,
  type FlinksWebhookEvent,
  type FlinksWebhookType,
} from './core/webhooks.js';

// Async polling helpers
export { poll, isPending, type PollOptions } from './core/poll.js';

// Case helpers (occasionally useful to consumers)
export { toCamelCase, toPascalCase, toSnakeCase } from './core/case.js';

// Shared types
export type {
  FlinksConfig,
  FlinksHosts,
  FlinksInstance,
  FlinksResponseBase,
  FlinksLink,
  Login,
  AsyncResult,
} from './types/index.js';

// Product APIs & their types
export { AuthorizeApi } from './products/authorize/authorize.js';
export type * from './products/authorize/types.js';
export { ConnectApi } from './products/connect/connect.js';
export type * from './products/connect/types.js';
export { EnrichApi } from './products/enrich/enrich.js';
export { UploadApi } from './products/upload/upload.js';
export { UtilitiesApi } from './products/utilities/utilities.js';
export { PayApi } from './products/pay/pay.js';
export type * from './products/pay/pay.js';
export { OutboundApi } from './products/outbound/outbound.js';
export { IdentityApi } from './products/identity/identity.js';
export type * from './products/identity/identity.js';
export { WealthApi } from './products/wealth/wealth.js';
export type * from './products/wealth/wealth.js';
