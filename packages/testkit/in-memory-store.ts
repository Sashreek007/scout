import {
  AgentConfigSchema,
  AlreadyExistsError,
  ApplicationSchema,
  assertFirstEvent,
  assertKeepsStage,
  JobSchema,
  MemoryEntrySchema,
  ModelsConfigSchema,
  NotFoundError,
  ProfileSchema,
  QuestionSchema,
  RunSchema,
  StageEventSchema,
  StaleStageError,
  moveStage,
  type AgentConfig,
  type Application,
  type ApplicationPatch,
  type Job,
  type MemoryEntry,
  type ModelsConfig,
  type Profile,
  type Question,
  type Run,
  type StageEvent,
  type Store,
} from '@scout/core';
import { settle } from './settle';

/** One argument only: `.map(structuredClone)` would pass the index as its options. */
function copy<T>(value: T): T {
  return structuredClone(value);
}

/**
 * The `Store` port in memory. It checks every write against the same schemas as the Firestore
 * store, returns copies so a test can't change stored data by accident, and passes the same
 * contract tests (`storeContract`).
 */
export class InMemoryStore implements Store {
  readonly #jobs = new Map<string, Job>();
  readonly #applications = new Map<string, Application>();
  readonly #events = new Map<string, StageEvent[]>();
  readonly #questions = new Map<string, Question>();
  readonly #memory = new Map<string, MemoryEntry>();
  readonly #runs = new Map<string, Run>();
  #profile: Profile | null = null;

  readonly jobs: Store['jobs'] = {
    get: (key) => settle(() => copy(this.#jobs.get(key) ?? null)),
    put: (job) =>
      settle(() => {
        const parsed = JobSchema.parse(job);
        this.#jobs.set(parsed.key, parsed);
      }),
    putMany: (jobs) =>
      settle(() => {
        const parsed = jobs.map((job) => JobSchema.parse(job));
        for (const job of parsed) this.#jobs.set(job.key, job);
      }),
    list: () => settle(() => [...this.#jobs.values()].map(copy)),
  };

  readonly applications: Store['applications'] = {
    get: (key) => settle(() => copy(this.#applications.get(key) ?? null)),
    create: (app, event) =>
      settle(() => {
        const parsed = ApplicationSchema.parse(app);
        const first = StageEventSchema.parse(event);
        assertFirstEvent(parsed.stage, first);
        if (this.#applications.has(parsed.jobKey)) {
          throw new AlreadyExistsError('applications', parsed.jobKey);
        }
        this.#applications.set(parsed.jobKey, parsed);
        this.#events.set(parsed.jobKey, [first]);
      }),
    update: (key, patch: ApplicationPatch) =>
      settle(() => {
        assertKeepsStage(patch);
        const current = this.#applications.get(key);
        if (!current) throw new NotFoundError('applications', key);
        this.#applications.set(key, ApplicationSchema.parse({ ...current, ...patch }));
      }),
    list: (filter = {}) =>
      settle(() =>
        [...this.#applications.values()]
          .filter((app) => filter.stage === undefined || app.stage === filter.stage)
          .map(copy),
      ),
    events: (key) => settle(() => (this.#events.get(key) ?? []).map(copy)),
  };

  // JavaScript runs this check and write without a break, so it is atomic like a transaction.
  moveStage: Store['moveStage'] = (key, move) =>
    settle(() => {
      const current = this.#applications.get(key);
      if (!current) throw new NotFoundError('applications', key);
      if (current.stage !== move.from) throw new StaleStageError(key, move.from, current.stage);
      const moved = moveStage(current, move.to, move.by, move.detail ?? null, move.at);
      const app = ApplicationSchema.parse(moved.app);
      const event = StageEventSchema.parse(moved.event);
      this.#applications.set(key, app);
      this.#events.get(key)?.push(event);
      return { app: copy(app), event: copy(event) };
    });

  readonly questions: Store['questions'] = {
    get: (id) => settle(() => copy(this.#questions.get(id) ?? null)),
    put: (question) =>
      settle(() => {
        const parsed = QuestionSchema.parse(question);
        this.#questions.set(parsed.id, parsed);
      }),
    list: (filter = {}) =>
      settle(() =>
        [...this.#questions.values()]
          .filter((question) => filter.status === undefined || question.status === filter.status)
          .map(copy),
      ),
  };

  readonly memory: Store['memory'] = {
    get: (questionKey) => settle(() => copy(this.#memory.get(questionKey) ?? null)),
    put: (entry) =>
      settle(() => {
        const parsed = MemoryEntrySchema.parse(entry);
        this.#memory.set(parsed.questionKey, parsed);
      }),
    list: () => settle(() => [...this.#memory.values()].map(copy)),
  };

  readonly profile: Store['profile'] = {
    get: () => settle(() => copy(this.#profile)),
    put: (profile) =>
      settle(() => {
        this.#profile = ProfileSchema.parse(profile);
      }),
  };

  #agentConfig: AgentConfig | null = null;
  #modelsConfig: ModelsConfig | null = null;

  readonly config: Store['config'] = {
    agent: {
      get: () => settle(() => AgentConfigSchema.parse(copy(this.#agentConfig ?? {}))),
      put: (config) =>
        settle(() => {
          this.#agentConfig = AgentConfigSchema.parse(config);
        }),
    },
    models: {
      get: () => settle(() => ModelsConfigSchema.parse(copy(this.#modelsConfig ?? {}))),
      put: (config) =>
        settle(() => {
          this.#modelsConfig = ModelsConfigSchema.parse(config);
        }),
    },
  };

  readonly runs: Store['runs'] = {
    get: (id) => settle(() => copy(this.#runs.get(id) ?? null)),
    put: (run) =>
      settle(() => {
        const parsed = RunSchema.parse(run);
        this.#runs.set(parsed.id, parsed);
      }),
    list: () => settle(() => [...this.#runs.values()].map(copy)),
  };
}
