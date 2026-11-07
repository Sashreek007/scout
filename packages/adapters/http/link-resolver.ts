import { USER_AGENT } from './http-client';

export interface LinkResolverOptions {
  /** 5 by default (#5). */
  maxRedirects?: number;
  /** For the whole chain of redirects. 10 seconds by default (#5). */
  timeoutMs?: number;
  /** Where each hop is actually requested; tests send it to the fake job board. */
  rewrite?: (url: string) => string;
}

export interface LinkResolver {
  /** The URL a short link leads to, or null if it can't be followed. */
  resolve: (url: string) => Promise<string | null>;
}

/**
 * Follows a short link, like vansh's go.vansh.nyc links, to the page it points at. Only the
 * redirect headers are read; no page body is downloaded. A link that doesn't redirect at all, takes
 * more than `maxRedirects` hops, or takes too long can't be followed, and the caller keeps the
 * short link.
 */
export function createLinkResolver(options: LinkResolverOptions = {}): LinkResolver {
  const maxRedirects = options.maxRedirects ?? 5;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const rewrite = options.rewrite ?? ((url: string) => url);

  return {
    async resolve(url) {
      const signal = AbortSignal.timeout(timeoutMs);
      let current = url;
      try {
        for (let hops = 0; hops <= maxRedirects; hops++) {
          const res = await fetch(rewrite(current), {
            redirect: 'manual',
            headers: { 'user-agent': USER_AGENT },
            signal,
          });
          await res.body?.cancel();
          const location = res.headers.get('location');
          if (res.status >= 300 && res.status < 400 && location) {
            if (hops === maxRedirects) return null;
            current = new URL(location, current).href;
            continue;
          }
          // The first answer wasn't a redirect, so the short link didn't lead anywhere.
          return hops === 0 ? null : current;
        }
        return null;
      } catch {
        return null;
      }
    },
  };
}
