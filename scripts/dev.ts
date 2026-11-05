// `pnpm dev` runs this inside `firebase emulators:exec`: it seeds the emulator, then serves the
// fake job board and the fake Claude API until Ctrl-C. Nothing here reaches the internet.
import { startFakeClaude, startFakeJobBoard } from '@scout/testkit';
import { emulatorFirestore, seedEmulator } from './seed-emulator';

const BOARD_PORT = 4318;
const CLAUDE_PORT = 4319;

const counts = await seedEmulator(emulatorFirestore());
const board = await startFakeJobBoard({ port: BOARD_PORT });
const claude = await startFakeClaude({ port: CLAUDE_PORT });

console.log(`
scout dev is running.

  Emulator UI       http://127.0.0.1:4000
  Firestore         ${process.env.FIRESTORE_EMULATOR_HOST ?? '?'} (project ${process.env.GCLOUD_PROJECT ?? '?'})
  Seeded            ${counts.jobs} jobs, ${counts.applications} applications, ${counts.questions} question, ${counts.memory} memory entry
  Fake job board    ${board.url}   (SCOUT_BOARD_BASE_URL)
  Fake Claude       ${claude.url}   (ANTHROPIC_BASE_URL)

Press Ctrl-C to stop.
`);

async function stop() {
  await Promise.allSettled([board.close(), claude.close()]);
  process.exit(0);
}
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
