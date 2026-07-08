import { describe, expect, it } from 'vitest';
import { FlinksError } from '../src/core/errors.js';
import { flinksCodeDescriptions } from '../src/core/flinks-codes.js';

describe('FlinksError shape', () => {
  it('exposes endpoint, status, code, message, and known description', () => {
    const err = new FlinksError('authorize', {
      httpStatusCode: 401,
      flinksCode: 'INVALID_LOGIN',
      message: 'bad creds',
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('FlinksError');
    expect(err.endpoint).toBe('authorize');
    expect(err.httpStatusCode).toBe(401);
    expect(err.flinksCode).toBe('INVALID_LOGIN');
    expect(err.flinksMessage).toBe('bad creds');
    expect(err.description).toBe(flinksCodeDescriptions.INVALID_LOGIN);
    expect(err.message).toBe('Flinks authorize failed: 401 INVALID_LOGIN');
  });

  it('describes unknown codes without crashing', () => {
    const err = new FlinksError('connect', { httpStatusCode: 500, flinksCode: 'MADE_UP' });
    expect(err.description).toBe('Unknown Flinks code: MADE_UP');
  });

  it('handles a body with no code at all', () => {
    const err = new FlinksError('connect', { httpStatusCode: 500 });
    expect(err.flinksCode).toBeUndefined();
    expect(err.description).toBeUndefined();
    expect(err.message).toBe('Flinks connect failed: 500');
  });

  it('handles a body with neither status nor code', () => {
    const err = new FlinksError('x', {});
    expect(err.message).toBe('Flinks x failed: ?');
  });

  it('preserves the full raw body for debugging', () => {
    const body = { httpStatusCode: 409, flinksCode: 'CONCURRENT_SESSION', requestId: 'r1', extra: [1, 2] };
    const err = new FlinksError('authorize', body);
    expect(err.body).toBe(body);
    expect(err.body.requestId).toBe('r1');
  });

  it('every documented description is a non-empty string', () => {
    for (const [code, desc] of Object.entries(flinksCodeDescriptions)) {
      expect(desc, code).toBeTruthy();
      expect(typeof desc).toBe('string');
    }
  });
});
