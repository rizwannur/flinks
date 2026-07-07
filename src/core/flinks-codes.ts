/**
 * Human-readable descriptions for every documented Flinks error code.
 * Source: Flinks API error-code reference. Keyed by the `FlinksCode` string.
 */
export const flinksCodeDescriptions: Record<string, string> = {
  OPERATION_PENDING:
    'The process is ongoing in the background. Switch to the matching async endpoint.',
  OPERATION_DISPATCHED:
    'The sync request took more than 210 seconds and was dispatched to the background.',
  INVALID_LOGIN: 'The provided LoginId, username, or password is invalid.',
  INVALID_REQUEST:
    'Credentials are missing/incomplete, or the request syntax is incorrect.',
  SESSION_NONEXISTENT: 'A request was made with an expired RequestId.',
  CARD_IN_USE: 'An operation was requested while the account is still processing.',
  INVALID_USERNAME: 'The username provided differs from what the bank expected.',
  INVALID_PASSWORD: 'The password provided differs from what the bank expected.',
  INVALID_SECURITY_RESPONSE:
    'The MFA response provided differs from what the bank expected.',
  QUESTION_NOT_FOUND: "The MFA prompt doesn't have a stored answer.",
  RETRY_LATER:
    'Flinks could not open a connection with the selected financial institution.',
  UNKNOWN_CHALLENGE_KEY:
    'The MFA answer was submitted against the wrong MFA prompt.',
  CONCURRENT_SESSION: 'Another session is already open with this LoginId.',
  UNAUTHORIZED:
    'The card was not authorized — bank problem, or a data endpoint was called before authorizing.',
  DISABLED_LOGIN:
    'The account was deactivated by the financial institution. The holder must contact their bank.',
  NEW_ACCOUNT:
    'The end user must act in their online banking before connecting with Flinks.',
  SESSION_EXPIRED:
    'The RequestId expired (8 min inactivity during Authorize, or 30 min processing timeout).',
  ALREADY_AUTHORIZED:
    'The Authorize endpoint was called after the user was already authorized.',
  SECURITYRESPONSES_INCOMPLETE:
    'Not all prompted MFA questions were answered in the request.',
  NO_TRANSACTION:
    'The account has no transactions, or fewer than the 25 required for your request.',
  DISABLED_INSTITUTION: 'The selected financial institution is not available.',
  AGGREGATION_ERROR: 'Flinks had an unexpected error and could not process the request.',
  METHOD_NOT_AVAILABLE:
    'The requested API is not enabled on your instance. Contact Flinks to enable it.',
};
