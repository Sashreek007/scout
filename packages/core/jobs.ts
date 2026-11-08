// Turning one run's listings into jobs (#7): every real posting stored exactly once, however many
// sources list it (docs/architecture.md, section 5, "Normalize, dedupe and filter").
import { BOARD_ATS, boardApplyUrl, type BoardAts } from './boards';
import { contentHash, listingKey, normalizeName, type ListingKey } from './keys';
import { hasCanadianLocation } from './locations';
import { titleWithoutTerms } from './roles';
import {
  DESCRIPTION_MAX_BYTES,
  JobSchema,
  type Job,
  type JobKey,
  type JobSourceRef,
  type Listing,
} from './schemas';
import { capUtf8 } from './text';

/** The source name of a link Sashreek pasted himself (#60). No run ever reads it. */
export const PASTED_SOURCE = 'you';

/** What this run managed to read, so a source that failed isn't mistaken for one that dropped a job. */
export interface Coverage {
  /** Sources whose fetch succeeded, by name: `simplify`, `vansh`, `greenhouse`, ... */
  sourcesRead: ReadonlySet<string>;
  /** Boards whose feed was read, as `{ats}:{token}`. A board that was skipped isn't here. */
  boardsRead: ReadonlySet<string>;
}

function isBoardAts(name: string): name is BoardAts {
  return (BOARD_ATS as readonly string[]).includes(name);
}

/**
 * True when this run read the place where `source` would list a job: the whole source for a GitHub
 * list, and the job's own board for Greenhouse, Lever or Ashby. A pasted link is never read.
 */
export function wasRead(coverage: Coverage, source: string, boardToken: string | null): boolean {
  if (source === PASTED_SOURCE || !coverage.sourcesRead.has(source)) return false;
  if (!isBoardAts(source)) return true;
  return boardToken !== null && coverage.boardsRead.has(`${source}:${boardToken}`);
}

export type JobChange = 'new' | 'changed' | 'unchanged';

export interface BuiltJob {
  job: Job;
  /** `new` and `changed` jobs have no triage and go to the filters and triage again. */
  change: JobChange;
}

export interface BuildJobsInput {
  /** This run's valid listings, from every source that could be read. */
  listings: readonly Listing[];
  /** Every stored job. */
  stored: readonly Job[];
  coverage: Coverage;
  /** Source names, best first. The first listing in this order gives a job its title and text. */
  priority: readonly string[];
  now: Date;
}

export interface BuildJobsResult {
  /** Every job this run saw, by key: new, changed, or seen again. Each is written once. */
  jobs: BuiltJob[];
  /** Postings with no location in Canada that weren't stored, because scout can't use them. */
  outsideCanada: number;
}

/** One job being built: its key, this run's listings for it, and what was stored before. */
interface Draft {
  id: ListingKey;
  listings: Listing[];
  stored: Job | null;
}

const SEASONS = ['winter', 'spring', 'summer', 'fall'] as const;

/**
 * A location reduced to its first part, so "Toronto, ON, Canada" and "Toronto, Canada" match, and
 * "Remote in Canada" and vansh's "Remote" are both "remote".
 */
function place(location: string): string {
  const first = normalizeName(location.split(',')[0] ?? '');
  return first.startsWith('remote') ? 'remote' : first.replace(/^can /, '').replace(/ canada$/, '');
}

function seasons(terms: readonly string[], rawTerm: string | null): Set<string> {
  const text = normalizeName([...terms, rawTerm ?? ''].join(' ')).replace(/\bautumn\b/g, 'fall');
  return new Set(SEASONS.filter((season) => new RegExp(`\\b${season}\\b`).test(text)));
}

const intersects = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  [...a].some((value) => b.has(value));

/** What the second pass compares: everything this run and the stored job say about a job. */
interface Identity {
  key: JobKey;
  isBoard: boolean;
  isStored: boolean;
  companies: Set<string>;
  titles: Set<string>;
  places: Set<string>;
  seasons: Set<string>;
  /** Apply URLs that were real links, not short links that couldn't be followed. */
  urls: Set<string>;
  /** Sources that list it this run. Two listings from one source are two postings. */
  sourcesNow: Set<string>;
  /** The best rank wins a merge: a board key, then a stored job, then the better source. */
  rank: [number, number, number, JobKey];
}

/**
 * Turns one run's listings into the jobs to write, in two passes.
 *
 * 1. Listings with the same key (`listingKey`) merge. A listing that an earlier run merged into
 *    another job, which its source and link on that job show, goes back into it.
 * 2. A listing with a fallback key merges into another job when the company, the title without
 *    its terms and one city match after normalizing, the seasons don't disagree, and the two come
 *    from different sources. A board job wins, then a stored job, then the better source. When two
 *    jobs could be it, it stays on its own rather than guess. So a vansh short link that couldn't
 *    be followed joins its Greenhouse job, and a Workday posting in both lists is stored once.
 *
 * A job is rebuilt from this run's listings when every source it was stored with was read. When
 * one of them couldn't be read, like a board that timed out, the stored posting is kept, so a bad
 * day doesn't change its text and send it back to triage. A job whose content hash changed loses
 * its filter result and triage, so both run again. New jobs are stored only with a location in
 * Canada. Every job seen gets `lastSeenAt`; jobs not seen are left to #10.
 */
export async function buildJobs(input: BuildJobsInput): Promise<BuildJobsResult> {
  const priority = (name: string) => {
    const at = input.priority.indexOf(name);
    return at === -1 ? input.priority.length : at;
  };
  const byPriority = (a: Listing, b: Listing) =>
    priority(a.source) - priority(b.source) ||
    compare(a.sourceUrl, b.sourceUrl) ||
    compare(a.title, b.title) ||
    compare(a.company, b.company);
  const stored = new Map(input.stored.map((job) => [job.key, job]));
  const storedId = (job: Job): ListingKey => ({
    key: job.key,
    ats: job.ats,
    boardToken: job.boardToken,
    postingId: job.postingId,
  });
  const storedRank = (job: Job): Identity['rank'] => [
    job.boardToken !== null ? 0 : 1,
    0,
    Math.min(...job.sources.map((ref) => priority(ref.name))),
    job.key,
  ];

  // Pass 1: by key, sending a listing back to the job it was merged into before.
  const holders = new Map<string, Job[]>();
  for (const job of input.stored) {
    for (const ref of job.sources) {
      if (ref.url === null) continue;
      const at = `${ref.name}\n${ref.url}`;
      holders.set(at, [...(holders.get(at) ?? []), job]);
    }
  }
  const drafts = new Map<JobKey, Draft>();
  const add = (id: ListingKey, listing: Listing) => {
    const draft = drafts.get(id.key) ?? { id, listings: [], stored: stored.get(id.key) ?? null };
    draft.listings.push(listing);
    drafts.set(id.key, draft);
  };
  for (const listing of input.listings) {
    const id = await listingKey(listing);
    const before =
      id.boardToken === null
        ? (holders.get(`${listing.source}\n${listing.sourceUrl}`) ?? [])
            .map((job) => ({ job, rank: storedRank(job) }))
            .sort((a, b) => compareRank(a.rank, b.rank))[0]?.job
        : undefined;
    add(before ? storedId(before) : id, listing);
  }

  // Pass 2: a fallback key merges into the one job it matches, if there is exactly one.
  const identities = new Map<JobKey, Identity>();
  for (const draft of drafts.values()) identities.set(draft.id.key, identify(draft, priority));
  for (const job of input.stored) {
    if (!drafts.has(job.key)) {
      identities.set(job.key, identify({ id: storedId(job), listings: [], stored: job }, priority));
    }
  }
  // Only jobs that share a company can match, so each listing is compared with a few, not all.
  const byCompany = new Map<string, Identity[]>();
  for (const identity of identities.values()) {
    for (const company of identity.companies) {
      byCompany.set(company, [...(byCompany.get(company) ?? []), identity]);
    }
  }
  const into = new Map<JobKey, JobKey>();
  for (const draft of drafts.values()) {
    const self = identities.get(draft.id.key);
    if (!self || self.isBoard) continue;
    const others = new Set([...self.companies].flatMap((company) => byCompany.get(company) ?? []));
    const matches = [...others].filter(
      (other) =>
        other.key !== self.key &&
        compareRank(other.rank, self.rank) < 0 &&
        !(self.isStored && other.isStored) &&
        !intersects(self.sourcesNow, other.sourcesNow) &&
        intersects(self.titles, other.titles) &&
        intersects(self.places, other.places) &&
        (self.seasons.size === 0 ||
          other.seasons.size === 0 ||
          intersects(self.seasons, other.seasons)),
    );
    const sameLink = matches.filter((other) => intersects(self.urls, other.urls));
    const boards = matches.filter((other) => other.isBoard);
    const best = sameLink.length > 0 ? sameLink : boards.length > 0 ? boards : matches;
    if (best.length === 1 && best[0]) into.set(self.key, best[0].key);
  }
  const target = (key: JobKey): JobKey => {
    const next = into.get(key);
    return next === undefined ? key : target(next);
  };
  for (const [from, to] of [...into].map(([from]) => [from, target(from)] as const)) {
    const source = drafts.get(from);
    if (!source) continue;
    drafts.delete(from);
    const job = stored.get(to);
    const id = drafts.get(to)?.id ?? (job ? storedId(job) : undefined);
    if (id) for (const listing of source.listings) add(id, listing);
  }

  // Building each job, new, changed or seen again.
  const jobs: BuiltJob[] = [];
  let outsideCanada = 0;
  for (const draft of [...drafts.values()].sort((a, b) => compare(a.id.key, b.id.key))) {
    const listings = [...draft.listings].sort(byPriority);
    const built = await build(draft.id, listings, input.now, priority);
    const before = draft.stored;
    if (!before) {
      if (hasCanadianLocation(built.locations)) {
        jobs.push({ change: 'new', job: JobSchema.parse(built) });
      } else {
        outsideCanada += 1;
      }
      continue;
    }

    const unread = before.sources.filter(
      (ref) => !wasRead(input.coverage, ref.name, before.boardToken),
    );
    if (unread.length > 0) {
      const sources = mergeRefs([...unread, ...built.sources], priority);
      jobs.push({
        change: 'unchanged',
        job: JobSchema.parse({ ...before, sources, lastSeenAt: input.now }),
      });
      continue;
    }
    const kept = {
      firstSeenAt: before.firstSeenAt,
      active: before.active,
      missedRuns: before.missedRuns,
    };
    if (built.contentHash === before.contentHash) {
      const job = { ...built, ...kept, filter: before.filter, triage: before.triage };
      jobs.push({ change: 'unchanged', job: JobSchema.parse(job) });
    } else {
      jobs.push({ change: 'changed', job: JobSchema.parse({ ...built, ...kept }) });
    }
  }
  return { jobs, outsideCanada };
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareRank(a: Identity['rank'], b: Identity['rank']): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || compare(a[3], b[3]);
}

function identify(draft: Draft, priority: (name: string) => number): Identity {
  const { listings, stored } = draft;
  const all = [
    ...listings,
    ...(stored
      ? [
          {
            company: stored.company,
            title: stored.title,
            locations: stored.locations,
            terms: stored.terms,
            rawTerm: stored.rawTerm,
          },
        ]
      : []),
  ];
  const names = [
    ...listings.map((listing) => listing.source),
    ...(stored?.sources.map((ref) => ref.name) ?? []),
  ];
  return {
    key: draft.id.key,
    isBoard: draft.id.boardToken !== null,
    isStored: stored !== null,
    companies: new Set(all.map((item) => normalizeName(item.company))),
    titles: new Set(all.map((item) => normalizeName(titleWithoutTerms(item.title)))),
    places: new Set(all.flatMap((item) => item.locations.map(place))),
    seasons: new Set(all.flatMap((item) => [...seasons(item.terms, item.rawTerm)])),
    urls: new Set([
      ...listings.filter((listing) => !listing.unresolvedUrl).map((listing) => listing.applyUrl),
      ...(stored && !stored.unresolvedUrl ? [stored.applyUrl] : []),
    ]),
    sourcesNow: new Set(listings.map((listing) => listing.source)),
    rank: [
      draft.id.boardToken !== null ? 0 : 1,
      stored !== null ? 0 : 1,
      Math.min(...names.map(priority)),
      draft.id.key,
    ],
  };
}

/** One reference per source, best source first. The first one given for a source wins. */
function mergeRefs(
  refs: readonly JobSourceRef[],
  priority: (name: string) => number,
): JobSourceRef[] {
  const seen = new Map<string, JobSourceRef>();
  for (const ref of refs) if (!seen.has(ref.name)) seen.set(ref.name, ref);
  return [...seen.values()].sort(
    (a, b) => priority(a.name) - priority(b.name) || compare(a.name, b.name),
  );
}

const unique = <T>(values: T[]) => [...new Set(values)];

/** A new job from this run's listings, best source first. */
async function build(
  id: ListingKey,
  listings: readonly Listing[],
  now: Date,
  priority: (name: string) => number,
): Promise<Job> {
  const [first] = listings;
  if (!first) throw new Error(`job ${id.key} has no listings`);
  const resolved = listings.find((listing) => !listing.unresolvedUrl);
  const description = listings.find((listing) => listing.description !== null)?.description ?? null;
  const posted = listings.flatMap((listing) =>
    listing.postedAt ? [listing.postedAt.getTime()] : [],
  );
  const content = {
    title: first.title,
    locations: unique(listings.flatMap((listing) => listing.locations)),
    terms: unique(listings.flatMap((listing) => listing.terms)),
    description: description === null ? null : capUtf8(description, DESCRIPTION_MAX_BYTES),
  };
  const board =
    id.boardToken !== null && id.postingId !== null && isBoardAts(id.ats)
      ? boardApplyUrl({ ats: id.ats, token: id.boardToken, postingId: id.postingId })
      : null;
  return {
    key: id.key,
    ats: id.ats,
    boardToken: id.boardToken,
    postingId: id.postingId,
    company: first.company,
    ...content,
    rawTerm: listings.find((listing) => listing.rawTerm !== null)?.rawTerm ?? null,
    applyUrl: board ?? resolved?.applyUrl ?? first.applyUrl,
    unresolvedUrl: board === null && resolved === undefined,
    postedAt: posted.length > 0 ? new Date(Math.min(...posted)) : null,
    sources: mergeRefs(
      listings.map((listing) => ({ name: listing.source, url: listing.sourceUrl })),
      priority,
    ),
    contentHash: await contentHash(content),
    filter: null,
    triage: null,
    active: true,
    missedRuns: 0,
    firstSeenAt: now,
    lastSeenAt: now,
  };
}
