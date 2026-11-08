// One daily run, step by step: collect (#5, #6), normalize (#7), filter (#8). Later steps arrive
// with their stories. Everything that talks to the outside comes in through `PipelineDeps`, so
// tests run the real steps against saved fixtures and an in-memory store.
import {
  BOARD_ATS,
  type BoardAts,
  type BoardRef,
  type Job,
  type JobSource,
  type Run,
  type RunError,
  type Store,
} from '@scout/core';
import { collectAll } from './steps/collect';
import { filterJobs } from './steps/filter';
import { normalize } from './steps/normalize';

export interface PipelineDeps {
  store: Store;
  /** The GitHub list sources, given the stored jobs so a short link is followed only once. */
  lists: (stored: readonly Job[]) => readonly JobSource[];
  /** The boards in sources/boards.yaml. */
  configuredBoards: Readonly<Record<BoardAts, readonly string[]>>;
  /** Makes this run's board sources for the boards to poll. */
  boardSources: (boards: BoardRef[]) => readonly JobSource[];
  /** Injected so tests are exact. */
  clock: () => Date;
  /** The git commit the run was built from, when known. */
  commit: string | null;
}

/** A run's ID: its start time to the second, like `2026-11-05T14-00-00Z-pipeline`. */
export function runId(startedAt: Date, kind: Run['kind'] = 'pipeline'): string {
  return `${startedAt.toISOString().slice(0, 19).replace(/:/g, '-')}Z-${kind}`;
}

/** Runs every step there is so far and records the run in `runs/{runId}`. */
export async function runPipeline(deps: PipelineDeps): Promise<Run> {
  const startedAt = deps.clock();
  const profile = await deps.store.profile.get();
  if (!profile) throw new Error('profile/main is missing: run `pnpm scout profile push` first');
  const stored = await deps.store.jobs.list();
  const lists = deps.lists(stored);
  const collected = await collectAll({
    lists,
    configuredBoards: deps.configuredBoards,
    jobs: stored,
    boardSources: deps.boardSources,
  });
  const normalized = await normalize({
    collected,
    stored,
    priority: [...BOARD_ATS, ...lists.map((source) => source.id)],
    now: startedAt,
  });
  const applications = await deps.store.applications.list();
  const filtered = filterJobs(
    normalized.jobs,
    profile,
    new Map(applications.map((app) => [app.jobKey, app.stage])),
  );
  await deps.store.jobs.putMany(filtered.jobs.map((built) => built.job));

  const errors: RunError[] = collected.outcomes.flatMap((outcome): RunError[] =>
    outcome.ok
      ? outcome.batch.skipped.map((part) => ({
          step: 'collect',
          target: part.target,
          message: part.message,
          at: startedAt,
        }))
      : [{ step: 'collect', target: outcome.source, message: outcome.error, at: startedAt }],
  );
  const run: Run = {
    id: runId(startedAt),
    kind: 'pipeline',
    status: errors.length === 0 ? 'ok' : 'partial',
    commit: deps.commit,
    startedAt,
    finishedAt: deps.clock(),
    sources: normalized.sources,
    jobs: normalized.counts,
    filterReasons: filtered.reasons,
    triageDecisions: {},
    tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    costUsd: 0,
    errors,
  };
  await deps.store.runs.put(run);
  return run;
}
