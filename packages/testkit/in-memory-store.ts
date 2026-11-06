import {
  AlreadyExistsError,
  ApplicationSchema,
  JobSchema,
  MemoryEntrySchema,
  NotFoundError,
  ProfileSchema,
  QuestionSchema,
  RunSchema,
  StageEventSchema,
  type Application,
  type ApplicationPatch,
  type Job,
  type MemoryEntry,
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

/** Fields only the stage machine may change (#2). */
const STAGE_FIELDS = ['jobKey', 'stage', 'stageAt', 'createdAt'] as const;

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
    list: () => settle(() => [...this.#jobs.values()].map(copy)),
  };

  readonly applications: Store['applications'] = {
    get: (key) => settle(() => copy(this.#applications.get(key) ?? null)),
    create: (app, event) =>
      settle(() => {
        const parsed = ApplicationSchema.parse(app);
        const first = StageEventSchema.parse(event);
        if (first.from !== null || first.to !== parsed.stage) {
          throw new Error(
            `the first event must go from nothing to ${parsed.stage}, got ${String(first.from)} to ${first.to}`,
          );
        }
        if (this.#applications.has(parsed.jobKey)) {
          throw new AlreadyExistsError('applications', parsed.jobKey);
        }
        this.#applications.set(parsed.jobKey, parsed);
        this.#events.set(parsed.jobKey, [first]);
      }),
    update: (key, patch: ApplicationPatch) =>
      settle(() => {
        for (const field of STAGE_FIELDS) {
          if (field in patch) {
            throw new Error(`${field} can't be changed with update; stages move through moveStage`);
          }
        }
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
