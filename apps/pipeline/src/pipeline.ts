// One daily run, step by step: collect (#5, #6), normalize (#7), filter (#8), triage (#9), and the
// digest (#12), all recorded in the run log (#11). Later steps arrive with their stories. Everything that talks to the outside comes in through `PipelineDeps`, so
// tests run the real steps against saved fixtures and an in-memory store.
import {
  BOARD_ATS,
  MISSES_TO_CLOSE,
  NO_USAGE,
  buildDigest,
  closeGonePosting,
  digestNotice,
  missedJobs,
  redact,
  type BoardAts,
  type BoardRef,
  type Digest,
  type Job,
  type JobSource,
  type Llm,
  type Notifier,
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
  /** Secret values to keep out of every error message, from `secretValues` (#11). */
  secrets?: readonly string[];
  /** Sends the digest: web push to the phone through FCM (#12). */
  notifier: Notifier;
  /** The dashboard's address, for the link to Today. Null until it is deployed (#42). */
  dashboardUrl: string | null;
}

/** A run's ID: its start time to the second, like `2026-11-05T14-00-00Z-pipeline`. */
export function runId(startedAt: Date, kind: Run['kind'] = 'pipeline'): string {
  return `${startedAt.toISOString().slice(0, 19).replace(/:/g, '-')}Z-${kind}`;
}

/** Runs older than this are deleted at the start of each run (#11). */
export const RUN_RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

/** What the steps add to the run record. */
type RunResult = Pick<
  Run,
  'sources' | 'jobs' | 'filterReasons' | 'triageDecisions' | 'tokens' | 'costUsd'
>;

/**
 * One daily run, recorded in `runs/{runId}` (#11). The record is written first, as `running`, with
 * the start time and commit, and runs older than 90 days are deleted. Every step that can fail on
 * its own, like one source, one board or one triage call, is caught and listed in `errors`, and
 * the run carries on and ends `partial`. Only a bad configuration, like a missing profile, or a
 * failure to reach Firestore stops it, and then it ends `failed`. If Firestore can't be reached
 * even to record that, the error is thrown. Every message has its secrets redacted first.
 */
export async function runPipeline(deps: PipelineDeps): Promise<Run> {
  const startedAt = deps.clock();
  const secrets = deps.secrets ?? [];
  const errors: RunError[] = [];
  const note = (error: Omit<RunError, 'at'>) => {
    errors.push({ ...error, message: redact(error.message, secrets), at: deps.clock() });
  };
  const opened: Run = {
    id: runId(startedAt),
    kind: 'pipeline',
    status: 'running',
    commit: deps.commit,
    startedAt,
    finishedAt: null,
    sources: {},
    jobs: {
      new: 0,
      changed: 0,
      unchanged: 0,
      outsideCanada: 0,
      missed: 0,
      inactive: 0,
      applicationsClosed: 0,
    },
    filterReasons: {},
    triageDecisions: {},
    tokens: { ...NO_USAGE },
    costUsd: 0,
    errors: [],
    digest: null,
  };
  // If this write fails, Firestore can't be reached and nothing could be recorded anyway.
  await deps.store.runs.put(opened);

  let result: Partial<RunResult> = {};
  let triaged: Job[] = [];
  let failed = false;
  try {
    await deps.store.runs.deleteBefore(new Date(startedAt.getTime() - RUN_RETENTION_DAYS * DAY_MS));
    ({ triaged, ...result } = await steps(deps, startedAt, note));
  } catch (error) {
    failed = true;
    note({ step: 'run', target: null, message: (error as Error).message, status: null });
  }
  const digest = await sendDigest(deps, triaged, errors, note);
  const run: Run = {
    ...opened,
    ...result,
    status: failed ? 'failed' : errors.length > 0 ? 'partial' : 'ok',
    finishedAt: deps.clock(),
    errors,
    digest,
  };
  await deps.store.runs.put(run);
  return run;
}

/**
 * The digest, sent after every run, a failed one too, so a missing notification always means the
 * run didn't happen (#12). A send that fails after its retries is noted, and the run doesn't fail.
 */
async function sendDigest(
  deps: PipelineDeps,
  triaged: readonly Job[],
  errors: readonly RunError[],
  note: (error: Omit<RunError, 'at'>) => void,
): Promise<Digest | null> {
  let digest: Digest | null = null;
  try {
    const [questions, sheets] = await Promise.all([
      deps.store.questions.list({ status: 'open' }),
      deps.store.applications.list({ stage: 'review' }),
    ]);
    digest = buildDigest({
      triaged,
      errors,
      waiting: { questions: questions.length, sheets: sheets.length },
    });
    await deps.notifier.send(digestNotice(digest, deps.dashboardUrl));
    return { ...digest, notified: true };
  } catch (error) {
    note({ step: 'digest', target: null, message: (error as Error).message, status: null });
    return digest;
  }
}

/** Every step there is so far. A throw here is a bad configuration or Firestore, and fails the run. */
async function steps(
  deps: PipelineDeps,
  startedAt: Date,
  note: (error: Omit<RunError, 'at'>) => void,
): Promise<RunResult & { triaged: Job[] }> {
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
  for (const outcome of collected.outcomes) {
    if (!outcome.ok) {
      note({ step: 'collect', target: outcome.source, message: outcome.error, status: null });
      continue;
    }
    for (const part of outcome.batch.skipped) {
      note({ step: 'collect', target: part.target, message: part.message, status: part.status });
    }
  }

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

  // Jobs no source listed this run: a miss each, and at three the posting counts as taken down.
  const missed = missedJobs({
    stored,
    seen: new Set(filtered.jobs.map((built) => built.job.key)),
    coverage: normalized.coverage,
  });
  await deps.store.jobs.putMany(missed.map((miss) => miss.job));
  let applicationsClosed = 0;
  for (const miss of missed.filter((m) => m.becameInactive)) {
    const closed = await closeGonePosting(deps.store, miss.job.key, {
      by: 'pipeline',
      detail: `not listed for ${String(MISSES_TO_CLOSE)} runs in a row`,
      at: startedAt,
    });
    if (closed) applicationsClosed += 1;
  }

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
  for (const error of triaged.errors) note(error);

  return {
    sources: normalized.sources,
    jobs: {
      ...normalized.counts,
      missed: missed.length,
      inactive: missed.filter((m) => m.becameInactive).length,
      applicationsClosed,
    },
    filterReasons: filtered.reasons,
    triageDecisions: triaged.decisions,
    tokens: triaged.usage,
    costUsd: triaged.costUsd,
    triaged: triaged.jobs,
  };
}
