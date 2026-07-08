/**
 * Guards for values interpolated into request paths.
 *
 * A path segment built from `undefined`/`''` would otherwise hit the wire as a
 * literal `.../GetAccountsDetailAsync/undefined`, and an unescaped segment could
 * inject extra path or query. `pathParam` fails fast and percent-encodes.
 */
export const pathParam = (value: string | undefined | null, name: string): string => {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Flinks: \`${name}\` is required and cannot be empty.`);
  }
  return encodeURIComponent(value);
};
