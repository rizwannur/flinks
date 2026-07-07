import { describe, expect, it } from 'vitest';
import { toCamelCase, toPascalCase, toSnakeCase } from '../src/core/case.js';

describe('case transforms', () => {
  it('converts request keys to PascalCase deeply', () => {
    expect(toPascalCase({ loginId: 'x', nested: { mostRecentCached: true } })).toEqual({
      LoginId: 'x',
      Nested: { MostRecentCached: true },
    });
  });

  it('camelCases PascalCase responses', () => {
    expect(toCamelCase({ LoginId: 'x', Balance: { Available: 1 } })).toEqual({
      loginId: 'x',
      balance: { available: 1 },
    });
  });

  it('camelCases snake_case OAuth responses', () => {
    expect(toCamelCase({ access_token: 'a', expires_in: 299 })).toEqual({
      accessToken: 'a',
      expiresIn: 299,
    });
  });

  it('snakeCases OAuth request bodies', () => {
    expect(toSnakeCase({ grantType: 'client_credentials', clientId: 'x' })).toEqual({
      grant_type: 'client_credentials',
      client_id: 'x',
    });
  });

  it('preserves arrays and primitives', () => {
    expect(toCamelCase({ Items: [{ AccountNumber: '1' }] })).toEqual({
      items: [{ accountNumber: '1' }],
    });
  });
});
