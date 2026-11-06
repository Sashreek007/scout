// Loads devSeed into the Firestore emulator through FirestoreStore, so every seeded document
// passes its schema and every seeded history is a path of allowed moves. It only ever touches the
// emulator and a demo- project (see emulatorFirestore).
import { FirestoreStore } from '@scout/adapters';
import { devSeed } from '@scout/testkit';
import type { Firestore } from 'firebase-admin/firestore';

export { emulatorFirestore } from '@scout/adapters';

export interface SeedCounts {
  jobs: number;
  applications: number;
  events: number;
  questions: number;
  memory: number;
  runs: number;
}

/** Seeds the emulator. Running it twice changes nothing. */
export async function seedEmulator(db: Firestore): Promise<SeedCounts> {
  const seed = devSeed();
  const store = new FirestoreStore(db);
  await store.profile.put(seed.profile);
  await db.doc('config/agent').set(seed.agentConfig);
  for (const entry of seed.memory) await store.memory.put(entry);
  for (const job of seed.jobs) await store.jobs.put(job);
  let events = 0;
  for (const { app, events: history } of seed.applications) {
    events += history.length;
    if (await store.applications.get(app.jobKey)) continue;
    const [first, ...moves] = history;
    if (!first) throw new Error(`the seed for ${app.jobKey} has no history`);
    await store.applications.create(
      { ...app, stage: first.to, stageAt: first.at, createdAt: first.at },
      first,
    );
    for (const move of moves) {
      if (move.from === null) throw new Error(`only the first event may start from nothing`);
      await store.moveStage(app.jobKey, { ...move, from: move.from });
    }
  }
  for (const question of seed.questions) await store.questions.put(question);
  for (const run of seed.runs) await store.runs.put(run);
  return {
    jobs: seed.jobs.length,
    applications: seed.applications.length,
    events,
    questions: seed.questions.length,
    memory: seed.memory.length,
    runs: seed.runs.length,
  };
}
