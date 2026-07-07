/**
 * Key-case transforms.
 *
 * The Flinks REST API speaks PascalCase (`LoginId`, `MostRecentCached`). This
 * client speaks idiomatic camelCase to its users, so every request body is
 * converted to PascalCase on the way out and every response back to camelCase
 * on the way in. Transforms are deep and array-aware; primitives pass through.
 */

type Json = unknown;

const isPlainObject = (value: unknown): value is Record<string, Json> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

const pascalCase = (key: string): string =>
  key.replace(/(^|[-_ ])([a-z])/g, (_, __, c: string) => c.toUpperCase());

// Handles PascalCase (`LoginId`), snake_case (`access_token`), and kebab-case,
// so both BankingServices and the OAuth-style Outbound/Pay hosts normalize.
const camelCase = (key: string): string =>
  key
    .replace(/[-_ ](\w)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(\w)/, (_, c: string) => c.toLowerCase());

const snakeCase = (key: string): string =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[- ]/g, '_')
    .toLowerCase();

const transformKeys = (value: Json, fn: (key: string) => string): Json => {
  if (Array.isArray(value)) {
    return value.map((item) => transformKeys(item, fn));
  }
  if (isPlainObject(value)) {
    const out: Record<string, Json> = {};
    for (const [key, val] of Object.entries(value)) {
      out[fn(key)] = transformKeys(val, fn);
    }
    return out;
  }
  return value;
};

/** Deep-convert an outgoing request body to PascalCase keys. */
export const toPascalCase = <T = unknown>(value: unknown): T =>
  transformKeys(value, pascalCase) as T;

/** Deep-convert an incoming response body to camelCase keys. */
export const toCamelCase = <T = unknown>(value: unknown): T =>
  transformKeys(value, camelCase) as T;

/** Deep-convert an outgoing request body to snake_case keys (OAuth-style hosts). */
export const toSnakeCase = <T = unknown>(value: unknown): T =>
  transformKeys(value, snakeCase) as T;
