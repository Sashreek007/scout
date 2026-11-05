import { storeContract } from '@scout/testkit';
import { clearEmulator, emulatorFirestore } from './emulator';
import { FirestoreStore } from './firestore-store';

const db = emulatorFirestore();

// The same suite InMemoryStore passes, against the Firestore emulator. It includes two concurrent
// moveStage calls on one application, of which exactly one may succeed.
storeContract('FirestoreStore', async () => {
  await clearEmulator();
  return new FirestoreStore(db);
});
