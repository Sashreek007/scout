import type { BoardAts, BoardRef } from '@scout/core';
import { createHttpClient } from '../http/http-client';
import { AshbySource } from './ashby-source';
import { BOARD_REQUESTS } from './board-source';
import { GreenhouseSource } from './greenhouse-source';
import { LeverSource } from './lever-source';
import { createLimiter } from './limiter';

export interface BoardSourcesOptions {
  /** Every board to poll this run, on any of the three ATSs. */
  boards: readonly BoardRef[];
  /** The feed URL for each ATS, with `{token}` in it, from `ats_feeds` in sources/sources.yaml. */
  feeds: Readonly<Record<BoardAts, string>>;
  /** Where each request is actually sent; tests send it to the fake job board. */
  rewrite?: (url: string) => string;
  /** 20 seconds; tests make it shorter rather than wait. */
  timeoutMs?: number;
  /** Injected so retry tests don't wait. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * The Greenhouse, Lever and Ashby sources for one run. They share one HTTP client and one limit, so
 * at most 4 board requests run at once in all (#6).
 */
export function createBoardSources(
  options: BoardSourcesOptions,
): [GreenhouseSource, LeverSource, AshbySource] {
  const http = createHttpClient({
    timeoutMs: options.timeoutMs ?? BOARD_REQUESTS.timeoutMs,
    retries: BOARD_REQUESTS.retries,
    ...(options.sleep ? { sleep: options.sleep } : {}),
  });
  const shared = {
    http,
    boards: options.boards,
    limiter: createLimiter(BOARD_REQUESTS.concurrency),
    ...(options.rewrite ? { rewrite: options.rewrite } : {}),
  };
  return [
    new GreenhouseSource({ ...shared, feedUrl: options.feeds.greenhouse }),
    new LeverSource({ ...shared, feedUrl: options.feeds.lever }),
    new AshbySource({ ...shared, feedUrl: options.feeds.ashby }),
  ];
}
