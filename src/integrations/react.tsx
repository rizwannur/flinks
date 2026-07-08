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

import { useEffect, useMemo, useState } from 'react';
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
  /**
   * Instead of passing `authorizeToken` yourself, point this at a backend route
   * that mints one (POST → `{ token }`). The hook fetches it on mount so you
   * skip the manual token round-trip. Ignored if `authorizeToken` is set.
   *
   * The route is typically a thin wrapper over
   * `flinks.authorize.generateAuthorizeToken()`.
   */
  tokenEndpoint?: string;
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
  const { instance, authorizeToken, tokenEndpoint, demo, redirectUrl, tag, params, onSuccess, onEvent } =
    options;

  // Auto-mint the token from a backend route when one isn't supplied directly.
  const [fetchedToken, setFetchedToken] = useState<string | undefined>();
  useEffect(() => {
    if (authorizeToken || !tokenEndpoint) return;
    let cancelled = false;
    void fetch(tokenEndpoint, { method: 'POST' })
      .then((r) => r.json() as Promise<{ token?: string }>)
      .then((d) => {
        if (!cancelled) setFetchedToken(d.token);
      })
      .catch(() => {
        /* leave the widget tokenless; the caller can surface the failure */
      });
    return () => {
      cancelled = true;
    };
  }, [authorizeToken, tokenEndpoint]);

  const token = authorizeToken ?? fetchedToken;

  const iframeUrl = useMemo(() => {
    const url = new URL(`https://${instance}-iframe.private.fin.ag/v2/`);
    if (demo) url.searchParams.set('demo', 'true');
    if (token) url.searchParams.set('authorizeToken', token);
    if (redirectUrl) url.searchParams.set('redirectUrl', redirectUrl);
    if (tag) url.searchParams.set('tag', tag);
    for (const [key, value] of Object.entries(params ?? {})) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }, [instance, token, demo, redirectUrl, tag, params]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: MessageEvent) => {
      const data = event.data as FlinksConnectEvent | undefined;
      if (!data || typeof data !== 'object') return;
      onEvent?.(data);
      // Only a real completion carries a loginId. Firing onSuccess on a bare
      // REDIRECT step handed callers an event with loginId === undefined, so
      // gate strictly on loginId — use onEvent for the raw REDIRECT stream.
      if (data.loginId) onSuccess?.(data);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onSuccess, onEvent]);

  return { iframeUrl };
}
