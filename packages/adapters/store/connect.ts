import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { emulatorFirestore } from './emulator';

/**
 * The Firestore the pipeline and the CLI write to. With FIRESTORE_EMULATOR_HOST set it is the local
 * emulator; otherwise it needs FIREBASE_PROJECT_ID and the service account key in
 * FIREBASE_SERVICE_ACCOUNT. It never falls back to other credentials, and never prints the key.
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
  const projectId = env.FIREBASE_PROJECT_ID;
  const key = env.FIREBASE_SERVICE_ACCOUNT;
  if (!projectId || !key) {
    throw new Error(
      'Set FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT in .env to reach a Firebase project, ' +
        'or FIRESTORE_EMULATOR_HOST to use the emulator (pnpm emulators).',
    );
  }
  let credentials: object;
  try {
    credentials = JSON.parse(key) as object;
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON. It should hold the key file.');
  }
  const app = getApps()[0] ?? initializeApp({ projectId, credential: cert(credentials) });
  return { db: getFirestore(app), target: `the Firebase project ${projectId}` };
}
