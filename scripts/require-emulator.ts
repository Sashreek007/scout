// Setup for the `emulator` Vitest project. Emulator tests must never reach a real Firebase project,
// so they refuse to start unless the emulator is running and the project is a demo project.
const host = process.env.FIRESTORE_EMULATOR_HOST;
const project = process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT_ID;

if (!host) {
  throw new Error(
    'FIRESTORE_EMULATOR_HOST is not set. Run emulator tests with `pnpm test`, which starts the emulator.',
  );
}
if (!project?.startsWith('demo-')) {
  throw new Error(
    `Emulator tests only run against a demo- project, got ${project ?? 'none'}. Run them with \`pnpm test\`.`,
  );
}
