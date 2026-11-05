// The tests every `Store` must pass. InMemoryStore runs them now; FirestoreStore runs the same
// suite against the emulator (#2), so the fake can't drift from the real thing.
import { AlreadyExistsError, NotFoundError, type Store } from '@scout/core';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  aCreationEvent,
  aJob,
  aMemoryEntry,
  anApplication,
  aProfile,
  aQuestion,
  aRun,
} from './builders';

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

      it('rejects a first event that does not start the application in its stage', async () => {
        const app = anApplication({ stage: 'queued' });
        await expect(
          store.applications.create(app, aCreationEvent(app, { to: 'approved' })),
        ).rejects.toThrow();
        await expect(
          store.applications.create(app, aCreationEvent(app, { from: 'review' })),
        ).rejects.toThrow();
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
        const review = anApplication({ jobKey: 'lever:eqbank:abc', stage: 'review' });
        await store.applications.create(queued, aCreationEvent(queued));
        await store.applications.create(review, aCreationEvent(review));
        expect((await store.applications.list({ stage: 'review' })).map((a) => a.jobKey)).toEqual([
          'lever:eqbank:abc',
        ]);
        expect(await store.applications.list()).toHaveLength(2);
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
  });
}
