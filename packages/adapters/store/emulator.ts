import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * A Firestore client for the local emulator only. It refuses to start unless the emulator is set
 * and the project is a `demo-` project, so a test or dev script can never reach scout-dev or
 * scout-prod.
 */
export function emulatorFirestore(): Firestore {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const projectId = process.env.GCLOUD_PROJECT ?? 'demo-scout';
  if (!host) throw new Error('FIRESTORE_EMULATOR_HOST is not set; start the emulator first');
  if (!projectId.startsWith('demo-')) {
    throw new Error(`refusing to use ${projectId}: only demo- projects run against the emulator`);
  }
  // The emulator needs no credentials. Without this the Admin SDK probes for a Google Cloud
  // metadata server and waits seconds for it to time out.
  process.env.METADATA_SERVER_DETECTION ??= 'none';
  const app = getApps()[0] ?? initializeApp({ projectId });
  return getFirestore(app);
}

/** Deletes every document in the emulator's database. */
export async function clearEmulator(): Promise<void> {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? '';
  const project = process.env.GCLOUD_PROJECT ?? '';
  if (!project.startsWith('demo-')) throw new Error(`refusing to clear ${project}`);
  const res = await fetch(
    `http://${host}/emulator/v1/projects/${project}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  if (!res.ok) throw new Error(`clearing the emulator failed: ${res.status}`);
}
