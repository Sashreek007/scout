// The first step of the daily run: read every source. One source failing never stops the others;
// its error is kept so the run log (#11) can mark it failed and the digest can name it.
import {
  boardsToPoll,
  type BoardAts,
  type BoardRef,
  type Job,
  type JobSource,
  type SourceBatch,
} from '@scout/core';

export type SourceOutcome =
  { source: string; ok: true; batch: SourceBatch } | { source: string; ok: false; error: string };

export async function collect(sources: readonly JobSource[]): Promise<SourceOutcome[]> {
  const settled = await Promise.allSettled(sources.map((source) => source.fetch()));
  return settled.map((result, i): SourceOutcome => {
    const source = sources[i]?.id ?? `source ${String(i)}`;
    return result.status === 'fulfilled'
      ? { source, ok: true, batch: result.value }
      : { source, ok: false, error: (result.reason as Error).message };
  });
}

export interface CollectInput {
  /** The GitHub list sources. They are read first, because their links name boards to poll. */
  lists: readonly JobSource[];
  /** The boards in sources/boards.yaml. */
  configuredBoards: Readonly<Record<BoardAts, readonly string[]>>;
  /** Every stored job, for the board tokens already known. Only jobs in Canada add a board. */
  jobs: readonly Job[];
  /** Makes this run's board sources, like `createBoardSources`, for the boards to poll. */
  boardSources: (boards: BoardRef[]) => readonly JobSource[];
}

export interface CollectResult {
  /** The lists' outcomes, then the boards'. */
  outcomes: SourceOutcome[];
  /** Every board polled this run. */
  boards: BoardRef[];
}

/**
 * Reads the GitHub lists, then polls every board in boards.yaml, and every board that a listing
 * from this run or a stored job in Canada points at (#6). The boards are worked out again each run
 * and never written back to the repo.
 */
export async function collectAll(input: CollectInput): Promise<CollectResult> {
  const lists = await collect(input.lists);
  const listings = lists.flatMap((outcome) => (outcome.ok ? outcome.batch.listings : []));
  const boards = boardsToPoll({ configured: input.configuredBoards, listings, jobs: input.jobs });
  const polled = await collect(input.boardSources(boards));
  return { outcomes: [...lists, ...polled], boards };
}

/**
 * Short links that one list already followed, from the stored jobs: each link that list gave that
 * differs from the job's resolved apply URL. Passed to that list's source so each short link is
 * followed only once. It relies on the job keeping each listing's `sourceUrl` in `sources[].url`
 * (#7). Only the named source's links count, so a board feed's own link to a careers page is never
 * taken for a short link.
 */
export function knownShortLinks(jobs: readonly Job[], source: string): Map<string, string> {
  const known = new Map<string, string>();
  for (const job of jobs) {
    if (job.unresolvedUrl) continue;
    for (const ref of job.sources) {
      if (ref.name === source && ref.url && ref.url !== job.applyUrl) {
        known.set(ref.url, job.applyUrl);
      }
    }
  }
  return known;
}
