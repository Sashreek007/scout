// The second step of the daily run: turn every listing into a job, merge the ones that are one
// posting, and write them (#7).
import {
  buildJobs,
  type BuiltJob,
  type Coverage,
  type Job,
  type JobCounts,
  type SourceCounts,
  type Store,
} from '@scout/core';
import type { CollectResult } from './collect';

export interface NormalizeInput {
  collected: CollectResult;
  /** Every stored job, read once at the start of the run. */
  stored: readonly Job[];
  /** Source names, best first: the boards, then the lists as sources.yaml orders them. */
  priority: readonly string[];
  now: Date;
}

export interface NormalizeResult {
  /** Every job this run saw, as written. */
  jobs: BuiltJob[];
  counts: JobCounts;
  /** Per source that could be read: rows fetched, valid and invalid, and the jobs it made new or changed. */
  sources: Record<string, SourceCounts>;
}

/** What this run read: the sources that answered, and the boards among them that weren't skipped. */
export function coverageOf(collected: CollectResult): Coverage {
  const sourcesRead = new Set<string>();
  const skipped = new Set<string>();
  for (const outcome of collected.outcomes) {
    if (!outcome.ok) continue;
    sourcesRead.add(outcome.source);
    for (const part of outcome.batch.skipped) skipped.add(part.target);
  }
  const boardsRead = new Set(
    collected.boards
      .map((board) => `${board.ats}:${board.token}`)
      .filter((board) => sourcesRead.has(board.split(':')[0] ?? '') && !skipped.has(board)),
  );
  return { sourcesRead, boardsRead };
}

/**
 * Builds the jobs from this run's listings and writes every one it saw, new, changed or seen again,
 * in batches of at most 500.
 */
export async function normalize(store: Store, input: NormalizeInput): Promise<NormalizeResult> {
  const listings = input.collected.outcomes.flatMap((o) => (o.ok ? o.batch.listings : []));
  const { jobs, outsideCanada } = await buildJobs({
    listings,
    stored: input.stored,
    coverage: coverageOf(input.collected),
    priority: input.priority,
    now: input.now,
  });
  await store.jobs.putMany(jobs.map((built) => built.job));

  const count = (change: BuiltJob['change'], source?: string) =>
    jobs.filter(
      (built) =>
        built.change === change &&
        (source === undefined || built.job.sources.some((ref) => ref.name === source)),
    ).length;
  const sources: Record<string, SourceCounts> = {};
  for (const outcome of input.collected.outcomes) {
    if (!outcome.ok) continue;
    sources[outcome.source] = {
      fetched: outcome.batch.fetched,
      valid: outcome.batch.listings.length,
      invalid: outcome.batch.invalid,
      new: count('new', outcome.source),
      changed: count('changed', outcome.source),
    };
  }
  return {
    jobs,
    counts: {
      new: count('new'),
      changed: count('changed'),
      unchanged: count('unchanged'),
      outsideCanada,
    },
    sources,
  };
}
