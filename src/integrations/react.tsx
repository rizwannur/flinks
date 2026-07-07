/**
 * React / browser integration.
 *
 * Two pieces, both zero-boilerplate:
 *
 * 1. `createFlinksClient()` — a fully-typed client that runs in the browser and
 *    proxies every call to your Next.js route (so the secret stays on the
 *    server). Same method names and types as the server `FlinksClient`.
 *
 *    ```ts
 *    const flinks = createFlinksClient(); // -> POSTs to /api/flinks
 *    const detail = await flinks.connect.getAccountsDetailAndWait({ requestId });
 *    ```
 *
 * 2. `useFlinksConnect()` — drives the Flinks Connect widget (the iframe your
 *    users link their bank through) and hands you the `loginId` on success.
 */

import { useEffect, useMemo } from 'react';
import type { FlinksClient } from '../client.js';

// ── Typed browser client ─────────────────────────────────────────────────────

export class FlinksClientError extends Error {
  readonly flinksCode?: string;
  readonly description?: string;
  readonly status: number;
  constructor(status: number, body: { message?: string; flinksCode?: string; description?: string }) {
    super(body.message ?? 'Flinks request failed');
    this.name = 'FlinksClientError';
    this.status = status;
    this.flinksCode = body.flinksCode;
    this.description = body.description;
  }
}

/**
 * A browser-side Flinks client, typed identically to the server client. Every
 * call becomes a `POST` to your handler route. Server-only namespaces work too,
 * subject to your route's `allow` list.
 */
export function createFlinksClient(endpoint = '/api/flinks'): FlinksClient {
  const call = async (product: string, method: string, args: unknown[]): Promise<unknown> => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ product, method, args }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      message?: string;
      flinksCode?: string;
      description?: string;
    };
    if (!res.ok) throw new FlinksClientError(res.status, data);
    return data;
  };

  const productProxy = (product: string) =>
    new Proxy(
      {},
      {
        get: (_t, method: string) =>
          (...args: unknown[]) =>
            call(product, method, args),
      },
    );

  return new Proxy(
    {},
    { get: (_t, product: string) => productProxy(product) },
  ) as unknown as FlinksClient;
}

// ── Connect widget hook ──────────────────────────────────────────────────────

export interface FlinksConnectEvent {
  step?: string;
  loginId?: string;
  requestId?: string;
  accountId?: string;
  institution?: string;
  [key: string]: unknown;
}

export interface UseFlinksConnectOptions {
  /** Your Flinks Connect instance subdomain (e.g. `toolbox`, `yourco`). */
  instance: string;
  /**
   * The authorize token from your backend (`GenerateAuthorizeToken`). Required
   * to fetch account data through the widget. Never expose your secret key —
   * mint the token server-side and pass only the token here.
   */
  authorizeToken?: string;
  /** Sandbox mode — adds `demo=true` so the Flinks Capital test bank appears. */
  demo?: boolean;
  /** Where Flinks redirects after linking (also arrives via postMessage). */
  redirectUrl?: string;
  /** Your custom tag, echoed back in webhooks and events for correlation. */
  tag?: string;
  /** Any additional widget query params (language, theme, feature flags). */
  params?: Record<string, string>;
  /** Fired when a user finishes linking — `event.loginId` is what you want. */
  onSuccess?: (event: FlinksConnectEvent) => void;
  /** Fired for every widget postMessage, if you want the raw stream. */
  onEvent?: (event: FlinksConnectEvent) => void;
}

/**
 * Wire up the Flinks Connect iframe. Returns the `iframeUrl` to render, and
 * listens for the widget's `postMessage` events, surfacing the `loginId` via
 * `onSuccess`.
 *
 * ```tsx
 * const { iframeUrl } = useFlinksConnect({
 *   instance: 'toolbox',
 *   onSuccess: ({ loginId }) => linkAccount(loginId!),
 * });
 * return <iframe src={iframeUrl} width="100%" height={600} />;
 * ```
 */
export function useFlinksConnect(options: UseFlinksConnectOptions): { iframeUrl: string } {
  const { instance, authorizeToken, demo, redirectUrl, tag, params, onSuccess, onEvent } = options;

  const iframeUrl = useMemo(() => {
    const url = new URL(`https://${instance}-iframe.private.fin.ag/v2/`);
    if (demo) url.searchParams.set('demo', 'true');
    if (authorizeToken) url.searchParams.set('authorizeToken', authorizeToken);
    if (redirectUrl) url.searchParams.set('redirectUrl', redirectUrl);
    if (tag) url.searchParams.set('tag', tag);
    for (const [key, value] of Object.entries(params ?? {})) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }, [instance, authorizeToken, demo, redirectUrl, tag, params]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: MessageEvent) => {
      const data = event.data as FlinksConnectEvent | undefined;
      if (!data || typeof data !== 'object') return;
      onEvent?.(data);
      if (data.loginId || data.step === 'REDIRECT') onSuccess?.(data);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onSuccess, onEvent]);

  return { iframeUrl };
}
