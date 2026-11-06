import { clearEmulator, FirestoreStore } from '@scout/adapters';
import { devSeed } from '@scout/testkit';
import { beforeEach, describe, expect, it } from 'vitest';
import { emulatorFirestore, seedEmulator } from './seed-emulator';

const db = emulatorFirestore();
const store = new FirestoreStore(db);

describe('seeding the emulator for pnpm dev', () => {
  beforeEach(clearEmulator);

  it('writes every seeded document, and seeding twice adds nothing', async () => {
    const seed = devSeed();
    await seedEmulator(db);
    await seedEmulator(db);
    expect(await store.jobs.list()).toHaveLength(seed.jobs.length);
    expect(await store.applications.list()).toHaveLength(seed.applications.length);
    for (const { app, events } of seed.applications) {
      expect(await store.applications.events(app.jobKey)).toEqual(events);
    }
  });

  it('stores documents the schemas accept when read back', async () => {
    await seedEmulator(db);
    expect(await store.profile.get()).toEqual(devSeed().profile);
    const app = await store.applications.get('greenhouse:northwind:4100001');
    expect(app?.stage).toBe('needs_answers');
  });
});
