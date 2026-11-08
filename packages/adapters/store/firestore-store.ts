import {
  AgentConfigSchema,
  AlreadyExistsError,
  ApplicationSchema,
  JobSchema,
  MemoryEntrySchema,
  ModelsConfigSchema,
  NotFoundError,
  ProfileSchema,
  QuestionSchema,
  RunSchema,
  StageEventSchema,
  StaleStageError,
  assertFirstEvent,
  assertKeepsStage,
  eventId,
  moveStage,
  writeBatches,
  type Store,
} from '@scout/core';
import { Timestamp, type DocumentData, type Firestore } from 'firebase-admin/firestore';
import type { z } from 'zod';

/** gRPC's ALREADY_EXISTS, which Firestore returns when `create` finds a document. */
const ALREADY_EXISTS = 6;

/** Firestore hands back Timestamps; the schemas expect Dates. */
export function fromFirestore(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate();
  if (Array.isArray(value)) return value.map(fromFirestore);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fromFirestore(v)]));
  }
  return value;
}

function read<S extends z.ZodType>(schema: S, data: DocumentData | undefined): z.infer<S> | null {
  return data === undefined ? null : schema.parse(fromFirestore(data));
}

/**
 * The `Store` port on Cloud Firestore, through the Admin SDK. It is used by the pipeline and the
 * agent, which skip security rules, so it checks every write against its schema itself. It passes
 * the same `storeContract` as InMemoryStore, against the emulator.
 */
export class FirestoreStore implements Store {
  readonly #db: Firestore;

  constructor(db: Firestore) {
    this.#db = db;
  }

  #events(key: string) {
    return this.#db.collection(`applications/${key}/events`);
  }

  readonly jobs: Store['jobs'] = {
    get: async (key) => read(JobSchema, (await this.#db.doc(`jobs/${key}`).get()).data()),
    put: async (job) => {
      const parsed = JobSchema.parse(job);
      await this.#db.doc(`jobs/${parsed.key}`).set(parsed);
    },
    putMany: async (jobs) => {
      const parsed = jobs.map((job) => JobSchema.parse(job));
      for (const chunk of writeBatches(parsed)) {
        const batch = this.#db.batch();
        for (const job of chunk) batch.set(this.#db.doc(`jobs/${job.key}`), job);
        await batch.commit();
      }
    },
    list: async () => {
      const snap = await this.#db.collection('jobs').get();
      return snap.docs.map((doc) => JobSchema.parse(fromFirestore(doc.data())));
    },
  };

  readonly applications: Store['applications'] = {
    get: async (key) =>
      read(ApplicationSchema, (await this.#db.doc(`applications/${key}`).get()).data()),
    create: async (app, event) => {
      const parsed = ApplicationSchema.parse(app);
      const first = StageEventSchema.parse(event);
      assertFirstEvent(parsed.stage, first);
      const batch = this.#db.batch();
      batch.create(this.#db.doc(`applications/${parsed.jobKey}`), parsed);
      batch.create(this.#events(parsed.jobKey).doc(eventId(first)), first);
      try {
        await batch.commit();
      } catch (error) {
        if ((error as { code?: unknown }).code === ALREADY_EXISTS) {
          throw new AlreadyExistsError('applications', parsed.jobKey);
        }
        throw error;
      }
    },
    update: async (key, patch) => {
      assertKeepsStage(patch);
      const ref = this.#db.doc(`applications/${key}`);
      await this.#db.runTransaction(async (tx) => {
        const current = read(ApplicationSchema, (await tx.get(ref)).data());
        if (!current) throw new NotFoundError('applications', key);
        tx.set(ref, ApplicationSchema.parse({ ...current, ...patch }));
      });
    },
    list: async (filter = {}) => {
      const all = this.#db.collection('applications');
      const query = filter.stage === undefined ? all : all.where('stage', '==', filter.stage);
      const snap = await query.get();
      return snap.docs.map((doc) => ApplicationSchema.parse(fromFirestore(doc.data())));
    },
    events: async (key) => {
      // Event IDs start with the time in milliseconds, so document order is the order of the moves.
      const snap = await this.#events(key).get();
      return snap.docs.map((doc) => StageEventSchema.parse(fromFirestore(doc.data())));
    },
  };

  moveStage: Store['moveStage'] = (key, move) => {
    const ref = this.#db.doc(`applications/${key}`);
    return this.#db.runTransaction(async (tx) => {
      // Read inside the transaction: if another move commits first, Firestore retries this one,
      // which then sees the new stage and fails instead of writing a second move.
      const current = read(ApplicationSchema, (await tx.get(ref)).data());
      if (!current) throw new NotFoundError('applications', key);
      if (current.stage !== move.from) throw new StaleStageError(key, move.from, current.stage);
      const moved = moveStage(current, move.to, move.by, move.detail ?? null, move.at);
      const app = ApplicationSchema.parse(moved.app);
      const event = StageEventSchema.parse(moved.event);
      tx.set(ref, app);
      // `create` fails rather than overwrite, so history is only ever added to.
      tx.create(this.#events(key).doc(eventId(event)), event);
      return { app, event };
    });
  };

  readonly questions: Store['questions'] = {
    get: async (id) => read(QuestionSchema, (await this.#db.doc(`questions/${id}`).get()).data()),
    put: async (question) => {
      const parsed = QuestionSchema.parse(question);
      await this.#db.doc(`questions/${parsed.id}`).set(parsed);
    },
    list: async (filter = {}) => {
      const all = this.#db.collection('questions');
      const query = filter.status === undefined ? all : all.where('status', '==', filter.status);
      const snap = await query.get();
      return snap.docs.map((doc) => QuestionSchema.parse(fromFirestore(doc.data())));
    },
  };

  readonly memory: Store['memory'] = {
    get: async (questionKey) =>
      read(MemoryEntrySchema, (await this.#db.doc(`memory/${questionKey}`).get()).data()),
    put: async (entry) => {
      const parsed = MemoryEntrySchema.parse(entry);
      await this.#db.doc(`memory/${parsed.questionKey}`).set(parsed);
    },
    list: async () => {
      const snap = await this.#db.collection('memory').get();
      return snap.docs.map((doc) => MemoryEntrySchema.parse(fromFirestore(doc.data())));
    },
  };

  readonly profile: Store['profile'] = {
    get: async () => read(ProfileSchema, (await this.#db.doc('profile/main').get()).data()),
    put: async (profile) => {
      await this.#db.doc('profile/main').set(ProfileSchema.parse(profile));
    },
  };

  readonly config: Store['config'] = {
    agent: {
      get: async () =>
        AgentConfigSchema.parse(
          fromFirestore((await this.#db.doc('config/agent').get()).data() ?? {}),
        ),
      put: async (config) => {
        await this.#db.doc('config/agent').set(AgentConfigSchema.parse(config));
      },
    },
    models: {
      get: async () =>
        ModelsConfigSchema.parse(
          fromFirestore((await this.#db.doc('config/models').get()).data() ?? {}),
        ),
      put: async (config) => {
        await this.#db.doc('config/models').set(ModelsConfigSchema.parse(config));
      },
    },
  };

  readonly runs: Store['runs'] = {
    get: async (id) => read(RunSchema, (await this.#db.doc(`runs/${id}`).get()).data()),
    put: async (run) => {
      const parsed = RunSchema.parse(run);
      await this.#db.doc(`runs/${parsed.id}`).set(parsed);
    },
    list: async () => {
      const snap = await this.#db.collection('runs').get();
      return snap.docs.map((doc) => RunSchema.parse(fromFirestore(doc.data())));
    },
    deleteBefore: async (cutoff) => {
      const snap = await this.#db.collection('runs').where('startedAt', '<', cutoff).get();
      for (const chunk of writeBatches(snap.docs, () => 1)) {
        const batch = this.#db.batch();
        for (const doc of chunk) batch.delete(doc.ref);
        await batch.commit();
      }
      return snap.size;
    },
  };
}
