import { FirestoreStore, clearEmulator, emulatorFirestore } from '@scout/adapters';
import { startFakeJobBoard } from '@scout/testkit';
import { describe, expect, it } from 'vitest';
import { runPipeline } from './pipeline';
import { clockAt, fixturePipeline } from './pipeline.fixture';

describe('runPipeline against the Firestore emulator', () => {
  it('creates no new documents when it runs twice on the same fixtures', async () => {
    await clearEmulator();
    const db = emulatorFirestore();
    const store = new FirestoreStore(db);
    const board = await startFakeJobBoard();
    try {
      const day1 = new Date('2026-11-05T14:00:00Z');
      const day2 = new Date('2026-11-06T14:00:00Z');
      const first = await runPipeline(await fixturePipeline(store, board, clockAt(day1)));
      const count = async () => (await db.collection('jobs').count().get()).data().count;
      expect(await count()).toBe(first.jobs.new);
      expect(first.jobs.new).toBe(647);

      const second = await runPipeline(await fixturePipeline(store, board, clockAt(day2)));
      expect(await count()).toBe(647);
      expect(second.jobs).toMatchObject({ new: 0, changed: 0, unchanged: 647 });
      const jobs = await store.jobs.list();
      expect(jobs.every((job) => job.lastSeenAt.getTime() === day2.getTime())).toBe(true);
      expect(jobs.every((job) => job.firstSeenAt.getTime() === day1.getTime())).toBe(true);
    } finally {
      await board.close();
    }
  }, 60_000);
});
