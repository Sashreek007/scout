// The fourth step of the daily run: triage with Claude (#9). The jobs that passed the filters and
// have no triage go to Claude in one batch; a good enough "apply" is queued straight away.
import {
  AlreadyExistsError,
  NO_USAGE,
  firstEvent,
  selectForTriage,
  type AgentConfig,
  type Application,
  type Job,
  type JobKey,
  type Llm,
  type Profile,
  type RunError,
  type Store,
  type TokenUsage,
  type TriageDecision,
} from '@scout/core';

export interface TriageStepInput {
  store: Store;
  triager: Pick<Llm, 'triage'>;
  /** The jobs this run saw, after the filters. */
  jobs: readonly Job[];
  /** True when no stored job had a triage before this run. */
  firstRun: boolean;
  profile: Profile;
  agent: AgentConfig;
  now: Date;
}

export interface TriageStepResult {
  /** The jobs that got a triage, to be written. */
  jobs: Job[];
  decisions: Partial<Record<TriageDecision, number>>;
  usage: TokenUsage;
  costUsd: number;
  /** Applications created in `queued` by the auto rule. */
  queued: JobKey[];
  /** Refusals and failed calls. Those jobs stay untriaged for the next run. */
  errors: RunError[];
}

/**
 * Triages at most `maxTriagePerRun` jobs, newest first, and on the first run only postings from
 * the last 21 days. A job decided `apply` with a score at or above `autoQueueScore` gets an
 * application in `queued`, with its first event by `pipeline`, unless it already has one.
 */
export async function triageJobs(input: TriageStepInput): Promise<TriageStepResult> {
  const { store, agent, now } = input;
  const picked = selectForTriage(input.jobs, {
    now,
    firstRun: input.firstRun,
    max: agent.maxTriagePerRun,
  });
  const result: TriageStepResult = {
    jobs: [],
    decisions: {},
    usage: { ...NO_USAGE },
    costUsd: 0,
    queued: [],
    errors: [],
  };
  if (picked.length === 0) return result;

  let run;
  try {
    run = await input.triager.triage(picked, input.profile);
  } catch (error) {
    result.errors.push({
      step: 'triage',
      target: null,
      message: (error as Error).message,
      at: now,
    });
    return result;
  }
  result.usage = run.usage;
  result.costUsd = run.costUsd;

  const byKey = new Map(picked.map((job) => [job.key, job]));
  for (const outcome of run.outcomes) {
    const job = byKey.get(outcome.jobKey);
    if (!job) continue;
    if (!outcome.result.ok) {
      result.errors.push({
        step: 'triage',
        target: job.key,
        message: outcome.result.message,
        at: now,
      });
      continue;
    }
    const { triage } = outcome.result;
    result.jobs.push({ ...job, triage });
    result.decisions[triage.decision] = (result.decisions[triage.decision] ?? 0) + 1;
    if (triage.decision === 'apply' && triage.score >= agent.autoQueueScore) {
      if (await queue(store, job, triage.score, now)) result.queued.push(job.key);
    }
  }
  return result;
}

/** Creates the application in `queued` by the auto rule. False when one already exists. */
async function queue(store: Store, job: Job, score: number, now: Date): Promise<boolean> {
  if (await store.applications.get(job.key)) return false;
  const app: Application = {
    jobKey: job.key,
    company: job.company,
    title: job.title,
    stage: 'queued',
    stageAt: now,
    form: null,
    sheet: null,
    lease: null,
    submitAttemptAt: null,
    submittedAt: null,
    confirmationText: null,
    notes: '',
    summary: null,
    createdAt: now,
  };
  try {
    await store.applications.create(
      app,
      firstEvent('queued', 'pipeline', `triage scored ${String(score)}`, now),
    );
    return true;
  } catch (error) {
    if (error instanceof AlreadyExistsError) return false;
    throw error;
  }
}
