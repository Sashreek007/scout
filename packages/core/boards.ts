// The job boards scout reads through public APIs: Greenhouse, Lever and Ashby (#6). A posting's apply
// URL names the company's board token, so every listing on one of them reveals a board to poll.
import { hasCanadianLocation } from './locations';
import type { Job, Listing } from './schemas';

export const BOARD_ATS = ['greenhouse', 'lever', 'ashby'] as const;
export type BoardAts = (typeof BOARD_ATS)[number];

/** One posting on a board, as its apply URL names it. */
export interface BoardPosting {
  ats: BoardAts;
  token: string;
  postingId: string;
}

/** A board to poll, with the company's name when a listing or a stored job gave one. */
export interface BoardRef {
  ats: BoardAts;
  token: string;
  company: string | null;
}

/**
 * Greenhouse and Ashby treat board tokens without regard to case; Lever doesn't (on 2026-11-07,
 * api.lever.co answered 404 for `EQBank` and 200 for `eqbank`, and the reverse for `CesiumAstro`).
 */
const IGNORES_CASE: Record<BoardAts, boolean> = { greenhouse: true, lever: false, ashby: true };

/** Letters, digits, `.`, `_` and `-`, with single spaces between words, like `hippocratic ai`. */
const TOKEN = /^[\w.-]+(?: [\w.-]+)*$/;
/** A Lever or Ashby posting ID. */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMBER = /^\d{1,20}$/;

/**
 * The form of a token scout stores and compares: trimmed, lowercased where the board ignores case,
 * and null when it isn't a token at all. Tokens end up in job keys and in API URLs, so nothing
 * outside the safe characters gets through.
 */
export function canonicalToken(ats: BoardAts, token: string): string | null {
  const trimmed = token.trim();
  if (trimmed.length > 100 || !TOKEN.test(trimmed)) return null;
  return IGNORES_CASE[ats] ? trimmed.toLowerCase() : trimmed;
}

/** The path after the token, for each board: `jobs/{id}`, `{id}` or `{id}/apply`, `{id}/application`. */
function postingId(ats: BoardAts, rest: string[]): string | null {
  const [first, second, third] = rest;
  if (third !== undefined || first === undefined) return null;
  switch (ats) {
    case 'greenhouse':
      return first === 'jobs' && second !== undefined && NUMBER.test(second) ? second : null;
    case 'lever':
      return UUID_PATTERN.test(first) && (second === undefined || second === 'apply')
        ? first.toLowerCase()
        : null;
    case 'ashby':
      return UUID_PATTERN.test(first) && (second === undefined || second === 'application')
        ? first.toLowerCase()
        : null;
  }
}

const HOSTS: Record<string, BoardAts> = {
  'job-boards.greenhouse.io': 'greenhouse',
  'boards.greenhouse.io': 'greenhouse',
  'jobs.lever.co': 'lever',
  'jobs.ashbyhq.com': 'ashby',
};

/**
 * Reads the board and posting from an apply URL. Four shapes are known:
 * `job-boards.greenhouse.io/{token}/jobs/{id}`, `boards.greenhouse.io/{token}/jobs/{id}`,
 * `jobs.lever.co/{token}/{id}` (also with `/apply`) and `jobs.ashbyhq.com/{token}/{id}` (also with
 * `/application`). The query string is ignored. Any other URL gives null, including the EU hosts,
 * the embedded Greenhouse form and board pages with no posting.
 */
export function parseBoardUrl(url: string): BoardPosting | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  const ats = HOSTS[parsed.hostname];
  if (!ats) return null;
  const [rawToken, ...rest] = parsed.pathname.split('/').filter((part) => part !== '');
  if (rawToken === undefined) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawToken);
  } catch {
    return null;
  }
  const token = canonicalToken(ats, decoded);
  const id = postingId(ats, rest);
  return token === null || id === null ? null : { ats, token, postingId: id };
}

/** The link each board uses for a posting's application. `parseBoardUrl` reads it back. */
export function boardApplyUrl({ ats, token, postingId: id }: BoardPosting): string {
  const t = encodeURIComponent(token);
  switch (ats) {
    case 'greenhouse':
      return `https://job-boards.greenhouse.io/${t}/jobs/${id}`;
    case 'lever':
      return `https://jobs.lever.co/${t}/${id}/apply`;
    case 'ashby':
      return `https://jobs.ashbyhq.com/${t}/${id}/application`;
  }
}

function isBoardAts(ats: string): ats is BoardAts {
  return (BOARD_ATS as readonly string[]).includes(ats);
}

/**
 * The boards to poll in one run (#6): the ones in `sources/boards.yaml`, plus every board that a
 * listing from this run or a stored job in Canada points at. Sashreek chose Canadian boards only on
 * #6: the saved Simplify list names 486 boards, and most of them come from postings outside
 * Canada. Stored jobs get the same check, because #7 stores every listing it sees, and without it
 * the other boards would come back the next day.
 *
 * Each board is listed once, sorted by ATS and token, with the company's name from the first
 * listing or job that gave one. Any listing or job can name a board, in Canada or not, so a board
 * from the file still gets a name. Nothing is written anywhere: the list is worked out each run.
 */
export function boardsToPoll(input: {
  configured: Readonly<Record<BoardAts, readonly string[]>>;
  listings: readonly Listing[];
  jobs: readonly Job[];
}): BoardRef[] {
  const boards = new Map<string, BoardRef>();
  /** Adds a board when `poll` is set, and fills in a missing company name either way. */
  const note = (ats: BoardAts, rawToken: string, company: string | null, poll: boolean) => {
    const token = canonicalToken(ats, rawToken);
    if (token === null) return;
    const key = `${ats}:${token}`;
    const known = boards.get(key);
    if (!known) {
      if (poll) boards.set(key, { ats, token, company });
    } else if (known.company === null && company !== null) known.company = company;
  };

  for (const ats of BOARD_ATS) {
    for (const token of input.configured[ats]) note(ats, token, null, true);
  }
  for (const listing of input.listings) {
    const posting = parseBoardUrl(listing.applyUrl);
    if (posting) {
      note(posting.ats, posting.token, listing.company, hasCanadianLocation(listing.locations));
    }
  }
  for (const job of input.jobs) {
    if (job.boardToken !== null && isBoardAts(job.ats)) {
      note(job.ats, job.boardToken, job.company, hasCanadianLocation(job.locations));
    }
  }

  const order = (ats: BoardAts) => BOARD_ATS.indexOf(ats);
  return [...boards.values()].sort(
    (a, b) => order(a.ats) - order(b.ats) || (a.token < b.token ? -1 : a.token > b.token ? 1 : 0),
  );
}
