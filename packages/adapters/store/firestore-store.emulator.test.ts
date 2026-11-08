import { aJob, storeContract } from '@scout/testkit';
import { describe, expect, it, vi } from 'vitest';
import { clearEmulator, emulatorFirestore } from './emulator';
import { FirestoreStore } from './firestore-store';

const db = emulatorFirestore();

// The same suite InMemoryStore passes, against the Firestore emulator. It includes two concurrent
// moveStage calls on one application, of which exactly one may succeed.
storeContract('FirestoreStore', async () => {
  await clearEmulator();
  return new FirestoreStore(db);
});

describe('FirestoreStore.jobs.putMany', () => {
  it('writes in batches of at most 500', async () => {
    await clearEmulator();
    const sizes: number[] = [];
    const batch = db.batch.bind(db);
    const spy = vi.spyOn(db, 'batch').mockImplementation(() => {
      const real = batch();
      const set = real.set.bind(real);
      let writes = 0;
      vi.spyOn(real, 'set').mockImplementation((...args: Parameters<typeof set>) => {
        writes += 1;
        return set(...args);
      });
      const commit = real.commit.bind(real);
      vi.spyOn(real, 'commit').mockImplementation(() => {
        sizes.push(writes);
        return commit();
      });
      return real;
    });
    try {
      const jobs = Array.from({ length: 1201 }, (_, i) =>
        aJob({ key: `greenhouse:northwind:${String(i)}`, postingId: String(i) }),
      );
      await new FirestoreStore(db).jobs.putMany(jobs);
      expect(sizes).toEqual([500, 500, 201]);
      expect((await db.collection('jobs').count().get()).data().count).toBe(1201);
    } finally {
      spy.mockRestore();
    }
  });
});
