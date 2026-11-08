// The tests every `Store` must pass. InMemoryStore runs them now; FirestoreStore runs the same
// suite against the emulator (#2), so the fake can't drift from the real thing.
import {
  AlreadyExistsError,
  ModelsConfigSchema,
  IllegalMoveError,
  NotFoundError,
  StaleStageError,
  type Application,
  type Stage,
  type Store,
} from '@scout/core';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  aCreationEvent,
  aJob,
  aMemoryEntry,
  anApplication,
  aProfile,
  aQuestion,
  aRun,
  anAgentConfig,
} from './builders';

const T0 = new Date('2026-11-05T14:00:00Z');

/** The shortest path of allowed moves from queued to each stage the contract tests use. */
const PATHS: Partial<Record<Stage, [Stage, Stage, 'pipeline' | 'you' | 'agent'][]>> = {
  queued: [],
  review: [
    ['queued', 'planning', 'pipeline'],
    ['planning', 'review', 'pipeline'],
  ],
  approved: [
    ['queued', 'planning', 'pipeline'],
    ['planning', 'review', 'pipeline'],
    ['review', 'approved', 'you'],
  ],
};

/** Creates an application in queued and walks it to `stage` through moveStage, a minute a move. */
async function createIn(
  store: Store,
  stage: keyof typeof PATHS,
  overrides: Partial<Application> = {},
): Promise<Application> {
  const app = anApplication({ ...overrides, stage: 'queued', stageAt: T0, createdAt: T0 });
  await store.applications.create(app, aCreationEvent(app));
  let current = app;
  for (const [i, [from, to, by]] of (PATHS[stage] ?? []).entries()) {
    const at = new Date(T0.getTime() + (i + 1) * 60_000);
    current = (await store.moveStage(app.jobKey, { from, to, by, at })).app;
  }
  return current;
}

/**
 * @param makeStore returns an empty store. It runs before every test, so a store backed by a real
 * database must clear it.
 */
export function storeContract(name: string, makeStore: () => Store | Promise<Store>): void {
  describe(`${name} meets the Store contract`, () => {
    let store: Store;
    beforeEach(async () => {
      store = await makeStore();
    });

    describe('jobs', () => {
      it('returns what was put, and null for an unknown key', async () => {
        const job = aJob();
        await store.jobs.put(job);
        expect(await store.jobs.get(job.key)).toEqual(job);
        expect(await store.jobs.get('greenhouse:northwind:missing')).toBeNull();
      });

      it('updates a job put twice instead of adding a copy', async () => {
        await store.jobs.put(aJob());
        await store.jobs.put(aJob({ missedRuns: 1 }));
        const jobs = await store.jobs.list();
        expect(jobs).toHaveLength(1);
        expect(jobs[0]?.missedRuns).toBe(1);
      });

      it('writes many jobs at once, updating the ones already there', async () => {
        await store.jobs.put(aJob({ missedRuns: 2 }));
        const jobs = Array.from({ length: 501 }, (_, i) =>
          aJob({
            key: `greenhouse:northwind:${String(4100001 + i)}`,
            postingId: String(4100001 + i),
          }),
        );
        await store.jobs.putMany(jobs);
        const stored = await store.jobs.list();
        expect(stored).toHaveLength(501);
        expect(await store.jobs.get('greenhouse:northwind:4100001')).toEqual(jobs[0]);
        await store.jobs.putMany([]);
        expect(await store.jobs.list()).toHaveLength(501);
      });

      it('writes none of many jobs when one fails its schema', async () => {
        await expect(
          store.jobs.putMany([aJob(), { ...aJob({ key: 'greenhouse:northwind:2' }), sources: [] }]),
        ).rejects.toThrow();
        expect(await store.jobs.list()).toEqual([]);
      });

      it('rejects a job that fails its schema and stores nothing', async () => {
        await expect(store.jobs.put({ ...aJob(), sources: [] })).rejects.toThrow();
        expect(await store.jobs.list()).toEqual([]);
      });

      it('returns a copy, so changing it does not change the store', async () => {
        const job = aJob();
        await store.jobs.put(job);
        const read = await store.jobs.get(job.key);
        read?.locations.push('Nowhere');
        expect((await store.jobs.get(job.key))?.locations).toEqual(job.locations);
      });
    });

    describe('applications', () => {
      it('creates an application with its first event', async () => {
        const app = anApplication();
        await store.applications.create(app, aCreationEvent(app));
        expect(await store.applications.get(app.jobKey)).toEqual(app);
        expect(await store.applications.events(app.jobKey)).toEqual([aCreationEvent(app)]);
      });

      it('allows at most one application per posting', async () => {
        const app = anApplication();
        await store.applications.create(app, aCreationEvent(app));
        await expect(store.applications.create(app, aCreationEvent(app))).rejects.toBeInstanceOf(
          AlreadyExistsError,
        );
      });

      it('creates an application only in queued, by you or the pipeline', async () => {
        const app = anApplication({ stage: 'queued' });
        await expect(
          store.applications.create(app, aCreationEvent(app, { to: 'approved' })),
        ).rejects.toThrow();
        await expect(
          store.applications.create(app, aCreationEvent(app, { from: 'review' })),
        ).rejects.toThrow();
        await expect(
          store.applications.create(app, aCreationEvent(app, { by: 'agent' })),
        ).rejects.toBeInstanceOf(IllegalMoveError);
        const approved = anApplication({ stage: 'approved' });
        await expect(
          store.applications.create(approved, aCreationEvent(approved)),
        ).rejects.toBeInstanceOf(IllegalMoveError);
        expect(await store.applications.get(app.jobKey)).toBeNull();
      });

      it('updates fields other than the stage', async () => {
        const app = anApplication();
        await store.applications.create(app, aCreationEvent(app));
        await store.applications.update(app.jobKey, { notes: 'Ask about the Go team' });
        expect((await store.applications.get(app.jobKey))?.notes).toBe('Ask about the Go team');
      });

      it('refuses to change the stage through update', async () => {
        const app = anApplication();
        await store.applications.create(app, aCreationEvent(app));
        const sneaky = { stage: 'approved' } as never;
        await expect(store.applications.update(app.jobKey, sneaky)).rejects.toThrow(/moveStage/);
        expect((await store.applications.get(app.jobKey))?.stage).toBe('queued');
      });

      it('fails to update an application that does not exist', async () => {
        await expect(
          store.applications.update('lever:nobody:1', { notes: 'x' }),
        ).rejects.toBeInstanceOf(NotFoundError);
      });

      it('lists applications by stage', async () => {
        const queued = anApplication();
        await store.applications.create(queued, aCreationEvent(queued));
        await createIn(store, 'review', { jobKey: 'lever:eqbank:abc' });
        expect((await store.applications.list({ stage: 'review' })).map((a) => a.jobKey)).toEqual([
          'lever:eqbank:abc',
        ]);
        expect(await store.applications.list()).toHaveLength(2);
      });
    });

    describe('moveStage', () => {
      const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

      it('moves the application and appends its event, oldest first', async () => {
        const app = await createIn(store, 'queued');
        const moved = await store.moveStage(app.jobKey, {
          from: 'queued',
          to: 'planning',
          by: 'pipeline',
          detail: 'reading the form',
          at: at(10),
        });
        expect(moved.app).toEqual({ ...app, stage: 'planning', stageAt: at(10) });
        expect(moved.event).toEqual({
          from: 'queued',
          to: 'planning',
          by: 'pipeline',
          at: at(10),
          detail: 'reading the form',
        });
        expect(await store.applications.get(app.jobKey)).toEqual(moved.app);
        const events = await store.applications.events(app.jobKey);
        expect(events.map((e) => [e.from, e.to])).toEqual([
          [null, 'queued'],
          ['queued', 'planning'],
        ]);
      });

      it('fails when the stage is no longer the one the caller saw, and writes nothing', async () => {
        const app = await createIn(store, 'review');
        await expect(
          store.moveStage(app.jobKey, { from: 'needs_answers', to: 'review', by: 'you' }),
        ).rejects.toBeInstanceOf(StaleStageError);
        expect((await store.applications.get(app.jobKey))?.stage).toBe('review');
        expect(await store.applications.events(app.jobKey)).toHaveLength(3);
      });

      it('refuses a move the table does not allow, and writes nothing', async () => {
        const app = await createIn(store, 'review');
        await expect(
          store.moveStage(app.jobKey, { from: 'review', to: 'filling', by: 'agent' }),
        ).rejects.toBeInstanceOf(IllegalMoveError);
        expect((await store.applications.get(app.jobKey))?.stage).toBe('review');
        expect(await store.applications.events(app.jobKey)).toHaveLength(3);
      });

      it('fails for an application that does not exist', async () => {
        await expect(
          store.moveStage('lever:nobody:1', { from: 'queued', to: 'planning', by: 'pipeline' }),
        ).rejects.toBeInstanceOf(NotFoundError);
      });

      it('lets only one of two concurrent moves from the same stage succeed', async () => {
        const app = await createIn(store, 'review');
        const results = await Promise.allSettled([
          store.moveStage(app.jobKey, { from: 'review', to: 'approved', by: 'you', at: at(30) }),
          store.moveStage(app.jobKey, { from: 'review', to: 'skipped', by: 'you', at: at(30) }),
        ]);
        const won = results.filter((r) => r.status === 'fulfilled');
        const lost = results.filter((r) => r.status === 'rejected');
        expect(won).toHaveLength(1);
        expect(lost).toHaveLength(1);
        expect(lost[0]?.reason).toBeInstanceOf(StaleStageError);
        const winner = won[0]?.value.app.stage;
        expect((await store.applications.get(app.jobKey))?.stage).toBe(winner);
        const events = await store.applications.events(app.jobKey);
        expect(events.map((e) => e.to)).toEqual(['queued', 'planning', 'review', winner]);
      });

      it('keeps every move when an application goes round a loop', async () => {
        const app = await createIn(store, 'approved');
        const path: [Stage, Stage, 'agent' | 'you'][] = [
          ['approved', 'filling', 'agent'],
          ['filling', 'needs_hand', 'agent'],
          ['needs_hand', 'filling', 'you'],
          ['filling', 'needs_hand', 'agent'],
          ['needs_hand', 'applied', 'you'],
        ];
        for (const [i, [from, to, by]] of path.entries()) {
          await store.moveStage(app.jobKey, { from, to, by, at: at(100 + i) });
        }
        const events = await store.applications.events(app.jobKey);
        expect(events.map((e) => e.to).slice(-6)).toEqual([
          'approved',
          'filling',
          'needs_hand',
          'filling',
          'needs_hand',
          'applied',
        ]);
      });
    });

    describe('questions', () => {
      it('stores questions and lists the open ones', async () => {
        const open = aQuestion();
        const answered = aQuestion({
          id: 'greenhouse:northwind:4100001:question_1004',
          fieldId: 'question_1004',
          status: 'answered',
          answer: 'Yes',
          answeredAt: new Date('2026-11-05T15:00:00Z'),
        });
        await store.questions.put(open);
        await store.questions.put(answered);
        expect(await store.questions.get(open.id)).toEqual(open);
        expect((await store.questions.list({ status: 'open' })).map((q) => q.id)).toEqual([
          open.id,
        ]);
        expect(await store.questions.list()).toHaveLength(2);
      });
    });

    describe('memory', () => {
      it('keys each answer by its question key', async () => {
        const entry = aMemoryEntry();
        await store.memory.put(entry);
        await store.memory.put({ ...entry, answer: 'A friend' });
        expect(await store.memory.get(entry.questionKey)).toEqual({ ...entry, answer: 'A friend' });
        expect(await store.memory.list()).toHaveLength(1);
      });
    });

    describe('profile', () => {
      it('starts empty and keeps one profile', async () => {
        expect(await store.profile.get()).toBeNull();
        const profile = aProfile();
        await store.profile.put(profile);
        expect(await store.profile.get()).toEqual(profile);
      });

      it('rejects a profile with a required field still TODO', async () => {
        const profile = aProfile();
        const unfinished = { ...profile, identity: { ...profile.identity, phone: 'TODO' } };
        await expect(store.profile.put(unfinished)).rejects.toThrow(/TODO is not allowed/);
      });
    });

    describe('runs', () => {
      it('stores runs by ID', async () => {
        const run = aRun();
        await store.runs.put(run);
        expect(await store.runs.get(run.id)).toEqual(run);
        expect(await store.runs.list()).toEqual([run]);
        expect(await store.runs.get('nope')).toBeNull();
      });
    });

    describe('config', () => {
      it('reads the defaults while a settings document is missing', async () => {
        expect(await store.config.agent.get()).toEqual(anAgentConfig());
        expect((await store.config.models.get()).triage.model).toBe('claude-haiku-5-5');
      });

      it('returns the settings that were put', async () => {
        await store.config.agent.put(anAgentConfig({ autoQueueScore: 90, maxTriagePerRun: 10 }));
        expect(await store.config.agent.get()).toMatchObject({
          autoQueueScore: 90,
          maxTriagePerRun: 10,
        });
        const models = ModelsConfigSchema.parse({
          triage: { model: 'claude-sonnet-5-5', batch: false },
        });
        await store.config.models.put(models);
        expect(await store.config.models.get()).toEqual(models);
      });

      it('rejects settings that fail their schema', async () => {
        await expect(store.config.agent.put({ ...anAgentConfig(), workers: 99 })).rejects.toThrow();
        expect((await store.config.agent.get()).workers).toBe(3);
      });
    });
  });
}
