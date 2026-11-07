import {
  DESCRIPTION_MAX_BYTES,
  ListingSchema,
  boardApplyUrl,
  capUtf8,
  isStudentRole,
  termsInTitle,
  type BoardAts,
  type BoardRef,
  type JobSource,
  type Listing,
  type SkippedTarget,
  type SourceBatch,
} from '@scout/core';
import type { z } from 'zod';
import { HttpError, type HttpClient } from '../http/http-client';
import { createLimiter, type Limiter } from './limiter';

/**
 * How board requests are made (#6): at most 4 at once across the three sources, each timing out
 * after 20 seconds. One retry covers a blip without letting a dead board hold a slot for long.
 */
export const BOARD_REQUESTS = { concurrency: 4, timeoutMs: 20_000, retries: 1 } as const;

export interface BoardSourceDeps {
  http: HttpClient;
  /** The boards to read. Boards on another ATS are left to that ATS's source. */
  boards: readonly BoardRef[];
  /** The feed URL with `{token}` in it, from `ats_feeds` in sources/sources.yaml. */
  feedUrl: string;
  /** Shared by the three board sources so their requests count against one limit. */
  limiter?: Limiter;
  /** Where each request is actually sent; tests send it to the fake job board. */
  rewrite?: (url: string) => string;
}

/** One posting as a board's feed describes it, before it becomes a listing. */
export interface BoardPosting {
  /** The board's ID for the posting: a number on Greenhouse, a UUID on Lever and Ashby. */
  id: string;
  /** The company's name, when the feed gives one. */
  company: string | null;
  title: string;
  locations: string[];
  /** The posting's apply link as the feed gave it, which may not be a valid URL. */
  url: string | null;
  postedAt: Date | null;
  description: string | null;
}

/** What one ATS's feed looks like, and how to read a posting from it. */
export interface BoardFeed<Row> {
  ats: BoardAts;
  /** What the feed is, for messages: "a Greenhouse board". */
  label: string;
  /** The posting rows in a board's answer, or null when the answer isn't this feed. */
  rows(body: unknown): unknown[] | null;
  row: z.ZodType<Row>;
  /** Null for a posting the board doesn't show, like an unlisted Ashby job. */
  posting(row: Row): BoardPosting | null;
}

const SourceUrlSchema = ListingSchema.shape.sourceUrl;

type BoardResult =
  | { ok: true; fetched: number; invalid: number; listings: Listing[] }
  | { ok: false; skipped: SkippedTarget };

/** A date from a feed, or null when it is missing or can't be read. */
export function feedDate(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Reads one ATS's public board feed for each of its boards (#6). Each board is fetched once, every
 * posting is checked with Zod, and only postings whose title reads like a student role become
 * listings. A board that answers 404, times out or answers with something else is skipped and
 * noted in `skipped`; the source fails only when no board could be read and at least one of them
 * failed for a reason other than 404, which means the API itself is down or has changed.
 */
export class BoardSource<Row> implements JobSource {
  readonly id: BoardAts;
  readonly #feed: BoardFeed<Row>;
  readonly #deps: BoardSourceDeps;
  readonly #limiter: Limiter;

  constructor(feed: BoardFeed<Row>, deps: BoardSourceDeps) {
    this.id = feed.ats;
    this.#feed = feed;
    this.#deps = deps;
    this.#limiter = deps.limiter ?? createLimiter(BOARD_REQUESTS.concurrency);
  }

  async fetch(): Promise<SourceBatch> {
    const boards = this.#deps.boards.filter((board) => board.ats === this.id);
    const results = await Promise.all(boards.map((board) => this.#read(board)));

    const batch: SourceBatch = { listings: [], fetched: 0, invalid: 0, skipped: [] };
    for (const result of results) {
      if (!result.ok) {
        batch.skipped.push(result.skipped);
        continue;
      }
      batch.fetched += result.fetched;
      batch.invalid += result.invalid;
      batch.listings.push(...result.listings);
    }

    const read = results.filter((r) => r.ok).length;
    const outage = batch.skipped.find((s) => s.status !== 404);
    if (boards.length > 0 && read === 0 && outage) {
      throw new Error(
        `${this.id}: none of the ${String(boards.length)} boards could be read. ${outage.message}`,
      );
    }
    return batch;
  }

  async #read(board: BoardRef): Promise<BoardResult> {
    const target = `${this.id}:${board.token}`;
    const url = this.#deps.feedUrl.replace('{token}', encodeURIComponent(board.token));
    const rewrite = this.#deps.rewrite ?? ((u: string) => u);

    let body: unknown;
    try {
      body = await this.#limiter.run(() => this.#deps.http.getJson(rewrite(url)));
    } catch (error) {
      const status = error instanceof HttpError ? error.status : null;
      const message =
        status === 404
          ? `${target} answered 404, so it was skipped`
          : `${target}: ${(error as Error).message}`;
      return { ok: false, skipped: { target, status, message } };
    }

    const rows = this.#feed.rows(body);
    if (rows === null) {
      const message = `${target} did not answer with ${this.#feed.label}`;
      return { ok: false, skipped: { target, status: 200, message } };
    }

    let invalid = 0;
    const listings: Listing[] = [];
    for (const value of rows) {
      const parsed = this.#feed.row.safeParse(value);
      if (!parsed.success) {
        invalid += 1;
        continue;
      }
      const posting = this.#feed.posting(parsed.data);
      if (posting === null || !isStudentRole(posting.title)) continue;
      const listing = ListingSchema.safeParse(this.#toListing(posting, board));
      if (listing.success) listings.push(listing.data);
      else invalid += 1;
    }
    return { ok: true, fetched: rows.length, invalid, listings };
  }

  #toListing(posting: BoardPosting, board: BoardRef): Listing {
    const applyUrl = boardApplyUrl({ ats: this.id, token: board.token, postingId: posting.id });
    const title = posting.title.trim();
    const description = capUtf8(posting.description?.trim() ?? '', DESCRIPTION_MAX_BYTES);
    return {
      source: this.id,
      company: posting.company ?? board.company ?? board.token,
      title,
      locations: [...new Set(posting.locations.map((l) => l.trim()).filter((l) => l !== ''))],
      ...termsInTitle(title),
      // Built from the board, not taken from the feed, so it matches the GitHub lists' links and
      // gives the same job key (#7), even when a company sends Greenhouse links to its own site.
      applyUrl,
      sourceUrl:
        posting.url !== null && SourceUrlSchema.safeParse(posting.url).success
          ? posting.url
          : applyUrl,
      unresolvedUrl: false,
      postedAt: posting.postedAt,
      description: description === '' ? null : description,
    };
  }
}
