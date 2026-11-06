// Loads devSeed into the Firestore emulator. It refuses to touch anything but the emulator and a
// demo- project, so it can never write to scout-dev or scout-prod.
import { devSeed } from '@scout/testkit';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export function emulatorFirestore(): Firestore {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const projectId = process.env.GCLOUD_PROJECT ?? 'demo-scout';
  if (!host) throw new Error('FIRESTORE_EMULATOR_HOST is not set; start the emulator first');
  if (!projectId.startsWith('demo-')) {
    throw new Error(`refusing to seed ${projectId}: only demo- projects are seeded`);
  }
  // The emulator needs no credentials. Without this the Admin SDK probes for a Google Cloud
  // metadata server and waits seconds for it to time out.
  process.env.METADATA_SERVER_DETECTION ??= 'none';
  const app = getApps()[0] ?? initializeApp({ projectId });
  return getFirestore(app);
}

export interface SeedCounts {
  jobs: number;
  applications: number;
  events: number;
  questions: number;
  memory: number;
  runs: number;
}

export async function seedEmulator(db: Firestore): Promise<SeedCounts> {
  const seed = devSeed();
  const batch = db.batch();
  batch.set(db.doc('profile/main'), seed.profile);
  batch.set(db.doc('config/agent'), seed.agentConfig);
  for (const entry of seed.memory) batch.set(db.doc(`memory/${entry.questionKey}`), entry);
  for (const job of seed.jobs) batch.set(db.doc(`jobs/${job.key}`), job);
  let events = 0;
  for (const { app, events: history } of seed.applications) {
    batch.set(db.doc(`applications/${app.jobKey}`), app);
    history.forEach((event, i) => {
      // Fixed IDs, so seeding twice doesn't add a second history.
      const id = `seed-${String(i).padStart(3, '0')}`;
      batch.set(db.doc(`applications/${app.jobKey}/events/${id}`), event);
      events += 1;
    });
  }
  for (const question of seed.questions) batch.set(db.doc(`questions/${question.id}`), question);
  for (const run of seed.runs) batch.set(db.doc(`runs/${run.id}`), run);
  await batch.commit();
  return {
    jobs: seed.jobs.length,
    applications: seed.applications.length,
    events,
    questions: seed.questions.length,
    memory: seed.memory.length,
    runs: seed.runs.length,
  };
}
