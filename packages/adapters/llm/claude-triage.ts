// Triage on Claude (#9): Haiku 5.5 at low effort through the Batches API at half price, with a
// structured output schema, the instructions and profile cached, and a refused job tried again on
// Sonnet 5.5 in code, because Haiku has no server-side fallback (docs/architecture.md, section 5c).
import type Anthropic from '@anthropic-ai/sdk';
import {
  NO_USAGE,
  TRIAGE_OUTPUT_SCHEMA,
  addUsage,
  costUsd,
  readTriage,
  triageInput,
  triageInstructions,
  type Job,
  type Llm,
  type Profile,
  type TaskModel,
  type TokenUsage,
  type TriageOutcome,
  type TriageRun,
} from '@scout/core';

export interface ClaudeTriageOptions {
  client: Anthropic;
  /** `config/models` triage settings: model, effort, batch, and where a refusal is retried. */
  settings: TaskModel;
  /** Injected so tests don't wait. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected so tests are exact. */
  clock?: () => Date;
  /** How often a batch is checked. 15 seconds by default. */
  pollMs?: number;
  /**
   * How long to wait for a batch before cancelling it. 10 minutes by default, so the daily run
   * stays well inside its 20 minutes (#13). Jobs left untriaged go in the next run's batch.
   */
  maxWaitMs?: number;
}

/** Enough room for low-effort thinking and the short JSON answer. */
const MAX_TOKENS = 4000;

/** What every answer has, whether it came from a batch or a direct call. */
interface Answer {
  model: string;
  stop_reason: string | null;
  stop_details?: { category?: string | null; explanation?: string | null } | null;
  content: { type: string; text?: string }[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  };
}

type Read =
  | { kind: 'ok'; outcome: TriageOutcome }
  | { kind: 'refused'; message: string; model: string }
  | { kind: 'error'; message: string };

/** Server-side fallback runs on Sonnet, Opus and Fable. Haiku has none, so it isn't sent there. */
function hasServerFallback(model: string): boolean {
  return /^claude-(?:sonnet|opus|fable)-/.test(model);
}

function usageOf(answer: Answer): TokenUsage {
  return {
    input: answer.usage.input_tokens,
    output: answer.usage.output_tokens,
    cacheRead: answer.usage.cache_read_input_tokens ?? 0,
    cacheWrite: answer.usage.cache_creation_input_tokens ?? 0,
  };
}

export class ClaudeTriage implements Pick<Llm, 'triage'> {
  readonly #client: Anthropic;
  readonly #settings: TaskModel;
  readonly #sleep: (ms: number) => Promise<void>;
  readonly #clock: () => Date;
  readonly #pollMs: number;
  readonly #maxWaitMs: number;
  #usage: TokenUsage = { ...NO_USAGE };
  #cost = 0;

  constructor(options: ClaudeTriageOptions) {
    this.#client = options.client;
    this.#settings = options.settings;
    this.#sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.#clock = options.clock ?? (() => new Date());
    this.#pollMs = options.pollMs ?? 15_000;
    this.#maxWaitMs = options.maxWaitMs ?? 10 * 60_000;
  }

  /**
   * Triages every job: in one batch when the settings say so, otherwise one call each. A job
   * Claude refused is tried again on `refusalModel`, one call each, with server-side fallback on.
   * A job that is still refused, or whose answer failed, comes back without a triage.
   */
  async triage(jobs: readonly Job[], profile: Profile): Promise<TriageRun> {
    this.#usage = { ...NO_USAGE };
    this.#cost = 0;
    if (jobs.length === 0) return { outcomes: [], usage: { ...NO_USAGE }, costUsd: 0 };
    const system = [
      {
        type: 'text' as const,
        text: triageInstructions(profile),
        cache_control: { type: 'ephemeral' as const },
      },
    ];
    const { model, batch, refusalModel } = this.#settings;
    const first = batch
      ? await this.#batch(jobs, system, model)
      : await Promise.all(jobs.map((job) => this.#direct(job, system, model)));

    const outcomes: TriageOutcome[] = [];
    for (const [i, read] of first.entries()) {
      const job = jobs[i];
      if (!job) continue;
      if (read.kind === 'ok') outcomes.push(read.outcome);
      else if (read.kind === 'refused' && refusalModel !== null) {
        const again = await this.#direct(job, system, refusalModel);
        outcomes.push(this.#outcome(job, again));
      } else outcomes.push(this.#outcome(job, read));
    }
    return { outcomes, usage: this.#usage, costUsd: this.#cost };
  }

  #outcome(job: Job, read: Read): TriageOutcome {
    if (read.kind === 'ok') return read.outcome;
    return read.kind === 'refused'
      ? {
          jobKey: job.key,
          result: { ok: false, reason: 'refusal', message: read.message },
          model: read.model,
        }
      : {
          jobKey: job.key,
          result: { ok: false, reason: 'error', message: read.message },
          model: null,
        };
  }

  #params(job: Job, system: Anthropic.TextBlockParam[], model: string) {
    return {
      model,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: 'user' as const, content: triageInput(job) }],
      output_config: {
        effort: this.#settings.effort,
        format: { type: 'json_schema' as const, schema: TRIAGE_OUTPUT_SCHEMA },
      },
    };
  }

  /** Reads one answer, after checking why it stopped, and counts its tokens and cost. */
  #read(job: Job, answer: Answer, batch: boolean): Read {
    const usage = usageOf(answer);
    this.#usage = addUsage(this.#usage, usage);
    this.#cost += costUsd(answer.model, usage, { batch });
    if (answer.stop_reason === 'refusal') {
      const details = answer.stop_details;
      const why = details?.explanation ?? details?.category ?? 'no reason given';
      return { kind: 'refused', message: `${answer.model} refused: ${why}`, model: answer.model };
    }
    if (answer.stop_reason === 'max_tokens') {
      return { kind: 'error', message: `${answer.model} ran out of tokens before answering` };
    }
    const text = answer.content.find((block) => block.type === 'text')?.text;
    if (text === undefined) return { kind: 'error', message: `${answer.model} gave no answer` };
    try {
      const triage = readTriage(text, job);
      return {
        kind: 'ok',
        outcome: { jobKey: job.key, result: { ok: true, triage }, model: answer.model },
      };
    } catch (error) {
      return {
        kind: 'error',
        message: `${answer.model} gave an answer that doesn't fit the schema: ${(error as Error).message.slice(0, 200)}`,
      };
    }
  }

  /** One job, one call. Server-side fallback is on wherever the model has it. */
  async #direct(job: Job, system: Anthropic.TextBlockParam[], model: string): Promise<Read> {
    try {
      const params = this.#params(job, system, model);
      const answer = hasServerFallback(model)
        ? await this.#client.beta.messages.create({
            ...params,
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
          })
        : await this.#client.messages.create(params);
      return this.#read(job, answer, false);
    } catch (error) {
      return { kind: 'error', message: `${model}: ${(error as Error).message}` };
    }
  }

  /**
   * Every job in one batch, waiting up to `maxWaitMs` for it to end. A batch that doesn't end in
   * time is cancelled, and its jobs come back with an error so the next run tries them again.
   */
  async #batch(jobs: readonly Job[], system: Anthropic.TextBlockParam[], model: string) {
    const ids = jobs.map((_, i) => `job-${String(i)}`);
    const created = await this.#client.messages.batches.create({
      requests: jobs.map((job, i) => ({
        custom_id: ids[i] ?? '',
        params: this.#params(job, system, model),
      })),
    });
    const started = this.#clock().getTime();
    let batch = created;
    while (batch.processing_status !== 'ended') {
      if (this.#clock().getTime() - started >= this.#maxWaitMs) {
        await this.#client.messages.batches.cancel(created.id);
        const minutes = Math.round(this.#maxWaitMs / 60_000);
        const message = `batch ${created.id} hadn't finished after ${String(minutes)} minutes, so it was cancelled`;
        return jobs.map((): Read => ({ kind: 'error', message }));
      }
      await this.#sleep(this.#pollMs);
      batch = await this.#client.messages.batches.retrieve(created.id);
    }

    const reads = new Map<string, Read>();
    for await (const entry of await this.#client.messages.batches.results(created.id)) {
      const i = ids.indexOf(entry.custom_id);
      const job = jobs[i];
      if (!job) continue;
      const { result } = entry;
      reads.set(
        entry.custom_id,
        result.type === 'succeeded'
          ? this.#read(job, result.message, true)
          : {
              kind: 'error',
              message:
                result.type === 'errored'
                  ? `${model}: ${result.error.error.message}`
                  : `${model}: the request was ${result.type}`,
            },
      );
    }
    return ids.map(
      (id): Read =>
        reads.get(id) ?? { kind: 'error', message: `batch ${created.id} had no result for ${id}` },
    );
  }
}
