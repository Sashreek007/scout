import { readFileSync } from 'node:fs';
import {
  NO_USAGE,
  TriageSchema,
  type JobKey,
  type Llm,
  type PlanInput,
  type PlanResult,
  type Profile,
  type Job,
  type Triage,
  type TriageOutcome,
  type TriageRun,
} from '@scout/core';
import { FIXTURES_DIR } from './paths';
import { settle } from './settle';

/** A recorded refusal: every model said no, with this explanation. */
export interface RecordedRefusal {
  refused: string;
}

export interface LlmRecordings {
  /** Triage by job key, or a refusal. */
  triage?: Record<JobKey, Triage | RecordedRefusal>;
  /** Plans by the job key of the form being planned. */
  plan?: Record<JobKey, PlanResult>;
}

/** The model name FakeLlm reports for every answer. */
export const FAKE_MODEL = 'fake-llm';

export type FakeLlmCall = { method: 'triage'; jobKey: JobKey } | { method: 'plan'; jobKey: JobKey };

/**
 * The `Llm` port with recorded responses and no network. A request with no recording fails loudly
 * instead of guessing, so a test always states what Claude "said". Every call is kept in `calls`.
 */
export class FakeLlm implements Llm {
  readonly calls: FakeLlmCall[] = [];
  readonly #recordings: LlmRecordings;

  constructor(recordings: LlmRecordings = {}) {
    this.#recordings = recordings;
  }

  /** The recordings saved in `fixtures/llm/recordings.json`, used by local dev and examples. */
  static recorded(): FakeLlm {
    const file = new URL('llm/recordings.json', FIXTURES_DIR);
    return new FakeLlm(JSON.parse(readFileSync(file, 'utf8')) as LlmRecordings);
  }

  /** Answers every job from the recordings, as one batch. Costs and tokens are zero. */
  triage(jobs: readonly Job[], _profile: Profile): Promise<TriageRun> {
    return settle(() => {
      const outcomes = jobs.map((job): TriageOutcome => {
        this.calls.push({ method: 'triage', jobKey: job.key });
        const recorded = this.#recordings.triage?.[job.key];
        if (!recorded) throw new Error(`FakeLlm has no recorded triage for ${job.key}`);
        if ('refused' in recorded) {
          return {
            jobKey: job.key,
            result: { ok: false, reason: 'refusal', message: recorded.refused },
            model: FAKE_MODEL,
          };
        }
        return {
          jobKey: job.key,
          result: { ok: true, triage: TriageSchema.parse(recorded) },
          model: FAKE_MODEL,
        };
      });
      return { outcomes, usage: { ...NO_USAGE }, costUsd: 0 };
    });
  }

  plan(input: PlanInput): Promise<PlanResult> {
    return settle(() => {
      this.calls.push({ method: 'plan', jobKey: input.job.key });
      const recorded = this.#recordings.plan?.[input.job.key];
      if (!recorded) throw new Error(`FakeLlm has no recorded plan for ${input.job.key}`);
      return structuredClone(recorded);
    });
  }
}
