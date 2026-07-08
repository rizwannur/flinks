import { describe, expect, it } from 'vitest';
import { toCamelCase, toPascalCase, toSnakeCase } from '../src/core/case.js';

describe('case — structure handling', () => {
  it('transforms deeply nested objects and arrays', () => {
    const input = {
      RequestId: 'r',
      Accounts: [
        { AccountNumber: '1', Transactions: [{ Amount: 10, Balance: { Available: 5 } }] },
      ],
    };
    expect(toCamelCase(input)).toEqual({
      requestId: 'r',
      accounts: [{ accountNumber: '1', transactions: [{ amount: 10, balance: { available: 5 } }] }],
    });
  });

  it('transforms an array at the top level', () => {
    expect(toCamelCase([{ AccountId: '1' }, { AccountId: '2' }])).toEqual([
      { accountId: '1' },
      { accountId: '2' },
    ]);
  });

  it('preserves null and passes primitives through', () => {
    expect(toCamelCase({ Balance: { Limit: null }, Count: 0, Ok: false, Name: '' })).toEqual({
      balance: { limit: null },
      count: 0,
      ok: false,
      name: '',
    });
  });

  it('keeps undefined values (key transformed, value preserved)', () => {
    const out = toCamelCase({ MaybeField: undefined }) as Record<string, unknown>;
    expect('maybeField' in out).toBe(true);
    expect(out.maybeField).toBeUndefined();
  });

  it('does not descend into Date instances', () => {
    const d = new Date(0);
    const out = toCamelCase({ CreatedAt: d }) as { createdAt: unknown };
    expect(out.createdAt).toBe(d);
    expect(out.createdAt).toBeInstanceOf(Date);
  });

  it('handles bare primitives / null / undefined at the root', () => {
    expect(toCamelCase('hello')).toBe('hello');
    expect(toCamelCase(42)).toBe(42);
    expect(toCamelCase(null)).toBeNull();
    expect(toCamelCase(undefined)).toBeUndefined();
  });
});

describe('case — key styles', () => {
  it('camelCases PascalCase, snake_case, and kebab-case', () => {
    expect(toCamelCase({ LoginId: 1 })).toEqual({ loginId: 1 });
    expect(toCamelCase({ access_token: 1 })).toEqual({ accessToken: 1 });
    expect(toCamelCase({ 'content-type': 1 })).toEqual({ contentType: 1 });
  });

  it('pascalCases outgoing camelCase keys', () => {
    expect(toPascalCase({ loginId: 1, mostRecentCached: true })).toEqual({
      LoginId: 1,
      MostRecentCached: true,
    });
  });

  it('snakeCases outgoing camelCase (OAuth hosts)', () => {
    expect(toSnakeCase({ grantType: 'x', clientId: 'y' })).toEqual({
      grant_type: 'x',
      client_id: 'y',
    });
  });

  it('is idempotent when keys are already in the target style', () => {
    expect(toCamelCase({ loginId: 1 })).toEqual({ loginId: 1 });
    expect(toPascalCase({ LoginId: 1 })).toEqual({ LoginId: 1 });
  });

  it('round-trips ordinary keys camel→pascal→camel', () => {
    const camel = { accountId: '1', mostRecentCached: true, nested: { routingNumber: '9' } };
    expect(toCamelCase(toPascalCase(camel))).toEqual(camel);
  });

  it('handles numeric-suffixed keys', () => {
    expect(toCamelCase({ Address1: 'x', Line2: 'y' })).toEqual({ address1: 'x', line2: 'y' });
    expect(toPascalCase({ address1: 'x' })).toEqual({ Address1: 'x' });
  });
});
