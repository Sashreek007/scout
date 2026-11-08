// One daily run, step by step: collect (#5, #6), normalize (#7), filter (#8), triage (#9). Later
// steps arrive with their stories. Everything that talks to the outside comes in through `PipelineDeps`, so
// tests run the real steps against saved fixtures and an in-memory store.
import {
  BOARD_ATS,
  type BoardAts,
  type BoardRef,
  type Job,
  type JobSource,
  type Llm,
  type Run,
  type RunError,
  type Store,
  type TaskModel,
} from '@scout/core';
import { collectAll } from './steps/collect';
import { filterJobs } from './steps/filter';
import { normalize } from './steps/normalize';
import { triageJobs } from './steps/triage';

export interface PipelineDeps {
  store: Store;
  /** The GitHub list sources, given the stored jobs so a short link is followed only once. */
  lists: (stored: readonly Job[]) => readonly JobSource[];
  /** The boards in sources/boards.yaml. */
  configuredBoards: Readonly<Record<BoardAts, readonly string[]>>;
  /** Makes this run's board sources for the boards to poll. */
  boardSources: (boards: BoardRef[]) => readonly JobSource[];
  /** Makes the triager from the `config/models` triage settings, like `ClaudeTriage`. */
  triager: (settings: TaskModel) => Pick<Llm, 'triage'>;
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
  const [agent, models] = await Promise.all([
    deps.store.config.agent.get(),
    deps.store.config.models.get(),
  ]);
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

  // Written before triage, so a failed batch never loses this run's jobs.
  const triaged = await triageJobs({
    store: deps.store,
    triager: deps.triager(models.triage),
    jobs: filtered.jobs.map((built) => built.job),
    firstRun: !stored.some((job) => job.triage !== null),
    profile,
    agent,
    now: startedAt,
  });
  if (triaged.jobs.length > 0) await deps.store.jobs.putMany(triaged.jobs);

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
  errors.push(...triaged.errors);
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
    triageDecisions: triaged.decisions,
    tokens: triaged.usage,
    costUsd: triaged.costUsd,
    errors,
  };
  await deps.store.runs.put(run);
  return run;
}
