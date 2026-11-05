import { readFileSync } from 'node:fs';
import {
  TriageSchema,
  type JobKey,
  type Llm,
  type PlanInput,
  type PlanResult,
  type Profile,
  type Job,
  type Triage,
} from '@scout/core';
import { FIXTURES_DIR } from './paths';
import { settle } from './settle';

export interface LlmRecordings {
  /** Triage by job key. */
  triage?: Record<JobKey, Triage>;
  /** Plans by the job key of the form being planned. */
  plan?: Record<JobKey, PlanResult>;
}

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

  triage(job: Job, _profile: Profile): Promise<Triage> {
    return settle(() => {
      this.calls.push({ method: 'triage', jobKey: job.key });
      const recorded = this.#recordings.triage?.[job.key];
      if (!recorded) throw new Error(`FakeLlm has no recorded triage for ${job.key}`);
      return TriageSchema.parse(recorded);
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
