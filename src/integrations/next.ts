/**
 * Next.js (App Router) integration.
 *
 * Expose Flinks to your frontend without ever shipping your API secret to the
 * browser. One file, one line:
 *
 * ```ts
 * // app/api/flinks/route.ts
 * import { createFlinksHandler } from '@rizwannur/flinks-node/next';
 *
 * export const { POST } = createFlinksHandler({
 *   instance: 'toolbox',
 *   customerId: process.env.FLINKS_CUSTOMER_ID!,
 *   apiSecret: process.env.FLINKS_API_SECRET!,
 *   allow: ['authorize.authorize', 'connect.getAccountsDetailAndWait'],
 * });
 * ```
 *
 * The browser client in `flinks-node/react` talks to this route. Uses only
 * web-standard `Request`/`Response`, so it needs no `next` dependency and also
 * works in any fetch-based runtime (Remix, Hono, Bun.serve, edge functions).
 */

import { FlinksClient } from '../client.js';
import { FlinksError } from '../core/errors.js';
import type { FlinksConfig } from '../types/index.js';

export interface FlinksHandlerConfig extends FlinksConfig {
  /**
   * Allowlist of `"<product>.<method>"` strings the browser may call. Strongly
   * recommended — without it, every method (including `connect.deleteCard`) is
   * reachable from the client. Omit only for trusted server-to-server use.
   */
  allow?: string[];
}

interface RpcBody {
  product?: string;
  method?: string;
  args?: unknown[];
}

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export function createFlinksHandler(config: FlinksHandlerConfig) {
  const { allow, ...clientConfig } = config;
  const flinks = new FlinksClient(clientConfig) as unknown as Record<
    string,
    Record<string, (...args: unknown[]) => Promise<unknown>>
  >;

  async function POST(request: Request): Promise<Response> {
    let body: RpcBody;
    try {
      body = (await request.json()) as RpcBody;
    } catch {
      return jsonResponse(400, { message: 'Invalid JSON body' });
    }

    const { product, method, args = [] } = body;
    if (!product || !method) {
      return jsonResponse(400, { message: 'Expected { product, method, args }' });
    }
    if (allow && !allow.includes(`${product}.${method}`)) {
      return jsonResponse(403, { message: `${product}.${method} is not allowed` });
    }

    const api = flinks[product];
    if (!api || typeof api[method] !== 'function') {
      return jsonResponse(400, { message: `Unknown method ${product}.${method}` });
    }

    try {
      const result = await api[method](...args);
      return jsonResponse(200, result);
    } catch (error) {
      if (error instanceof FlinksError) {
        return jsonResponse(error.httpStatusCode ?? 500, {
          message: error.flinksMessage ?? error.message,
          flinksCode: error.flinksCode,
          description: error.description,
        });
      }
      return jsonResponse(500, { message: 'Internal error' });
    }
  }

  return { POST };
}
