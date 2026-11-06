/** Every request scout makes says who it is, and nothing about him (#5). */
export const USER_AGENT = 'scout/0.1 (personal job search)';

export interface HttpClientOptions {
  /** Per attempt. 30 seconds by default. */
  timeoutMs?: number;
  /** Retries after the first attempt. 3 by default. */
  retries?: number;
  /** The first wait before a retry; each later wait doubles. 1 second by default. */
  backoffMs?: number;
  /** Injected so tests don't wait for real. */
  sleep?: (ms: number) => Promise<void>;
}

/** A request that failed for good: an error status, a timeout, or the network. */
export class HttpError extends Error {
  override readonly name = 'HttpError';
  constructor(
    readonly url: string,
    /** The last HTTP status, or null when no response came back. */
    readonly status: number | null,
    readonly attempts: number,
    message: string,
  ) {
    super(message);
  }
}

export interface HttpClient {
  getJson(url: string): Promise<unknown>;
}

const realSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** Outages and rate limits are worth retrying; any other status is the server's answer. */
function retryable(status: number | null): boolean {
  return status === null || status === 429 || status >= 500;
}

export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const retries = options.retries ?? 3;
  const backoffMs = options.backoffMs ?? 1000;
  const sleep = options.sleep ?? realSleep;

  async function attempt(url: string): Promise<{ status: number; text: string }> {
    const res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { status: res.status, text: await res.text() };
  }

  return {
    async getJson(url) {
      let status: number | null = null;
      let reason = '';
      for (let tries = 1; tries <= retries + 1; tries++) {
        if (tries > 1) await sleep(backoffMs * 2 ** (tries - 2));
        try {
          const res = await attempt(url);
          status = res.status;
          if (res.status >= 200 && res.status < 300) {
            try {
              return JSON.parse(res.text) as unknown;
            } catch {
              throw new HttpError(
                url,
                res.status,
                tries,
                `${url} answered with a body that is not JSON`,
              );
            }
          }
          reason = `answered ${String(res.status)}`;
        } catch (error) {
          if (error instanceof HttpError) throw error;
          status = null;
          const name = (error as Error).name;
          reason =
            name === 'TimeoutError' || name === 'AbortError'
              ? `timed out after ${String(timeoutMs)} ms`
              : `failed: ${(error as Error).message}`;
        }
        if (!retryable(status) || tries === retries + 1) {
          throw new HttpError(url, status, tries, `${url} ${reason} (attempt ${String(tries)})`);
        }
      }
      throw new HttpError(url, status, retries + 1, `${url} ${reason}`);
    },
  };
}
