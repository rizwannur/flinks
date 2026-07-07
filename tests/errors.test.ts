import { describe, expect, it } from 'vitest';
import { FlinksError } from '../src/core/errors.js';

describe('FlinksError', () => {
  it('exposes code, status, and a known description', () => {
    const err = new FlinksError('authorize', {
      httpStatusCode: 401,
      flinksCode: 'INVALID_LOGIN',
      message: 'bad',
    });
    expect(err.name).toBe('FlinksError');
    expect(err.httpStatusCode).toBe(401);
    expect(err.flinksCode).toBe('INVALID_LOGIN');
    expect(err.description).toContain('invalid');
    expect(err.message).toContain('authorize');
  });

  it('falls back gracefully for unknown codes', () => {
    const err = new FlinksError('connect', { httpStatusCode: 500, flinksCode: 'MADE_UP' });
    expect(err.description).toContain('Unknown Flinks code');
  });
});
