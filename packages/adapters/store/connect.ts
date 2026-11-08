import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { emulatorFirestore } from './emulator';

/**
 * The Firestore the pipeline and the CLI write to. With FIRESTORE_EMULATOR_HOST set it is the local
 * emulator; otherwise it needs the service account key in FIREBASE_SERVICE_ACCOUNT, and the
 * project in FIREBASE_PROJECT_ID or the key's own project_id. It never falls back to other
 * credentials, and never prints the key.
 */
export function connectFirestore(env: NodeJS.ProcessEnv = process.env): {
  db: Firestore;
  target: string;
} {
  if (env.FIRESTORE_EMULATOR_HOST) {
    return {
      db: emulatorFirestore(),
      target: `the emulator at ${env.FIRESTORE_EMULATOR_HOST} (${env.GCLOUD_PROJECT ?? 'demo-scout'})`,
    };
  }
  const key = env.FIREBASE_SERVICE_ACCOUNT;
  if (!key) {
    throw new Error(
      'Set FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT in .env to reach a Firebase project, ' +
        'or FIRESTORE_EMULATOR_HOST to use the emulator (pnpm emulators).',
    );
  }
  let credentials: { project_id?: unknown };
  try {
    credentials = JSON.parse(key) as { project_id?: unknown };
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON. It should hold the key file.');
  }
  // The key file names its project, so the daily workflow needs only the two secrets (#13).
  const projectId =
    env.FIREBASE_PROJECT_ID ??
    (typeof credentials.project_id === 'string' ? credentials.project_id : undefined);
  if (!projectId) {
    throw new Error('Set FIREBASE_PROJECT_ID: the service account key names no project.');
  }
  const app = getApps()[0] ?? initializeApp({ projectId, credential: cert(credentials as object) });
  return { db: getFirestore(app), target: `the Firebase project ${projectId}` };
}
