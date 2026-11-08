// The pipeline wired to the real world: Firestore, the GitHub lists and job boards, Claude and FCM
// (#13). `main.ts` runs it; the emulator test runs the same wiring against the fakes. Every secret
// is read from the environment by the library that needs it, and never passes through here.
import {
  ClaudeTriage,
  FirestoreStore,
  GitHubListSource,
  PushNotifier,
  connectFirestore,
  createBoardSources,
  createClaudeClient,
  createHttpClient,
  createLinkResolver,
  firebaseMessaging,
} from '@scout/adapters';
import { hasCanadianLocation, secretValues } from '@scout/core';
import { loadBoards } from './config/boards';
import { loadSources } from './config/sources';
import type { PipelineDeps } from './pipeline';
import { knownShortLinks } from './steps/collect';

/**
 * How long triage waits for its batch in the daily run. With collecting and writing, a run stays
 * under 10 minutes even when the batch is slow, well inside the job's 20 (#13).
 */
export const DAILY_TRIAGE_WAIT_MS = 7 * 60_000;

/** A commit hash, or null for anything else. */
function commitOf(value: string | undefined): string | null {
  return value !== undefined && /^[0-9a-f]{7,40}$/.test(value) ? value : null;
}

/**
 * Everything the daily run needs, from the environment: `FIREBASE_SERVICE_ACCOUNT` and
 * `FIREBASE_PROJECT_ID` (or the emulator), `ANTHROPIC_API_KEY`, `SCOUT_COMMIT` and
 * `SCOUT_DASHBOARD_URL`. `SCOUT_BOARD_BASE_URL` and `ANTHROPIC_BASE_URL` send every request to the
 * fake job board and the fake Claude instead, for `pnpm dev` and the tests.
 */
export async function productionDeps(env: NodeJS.ProcessEnv = process.env): Promise<{
  deps: PipelineDeps;
  target: string;
}> {
  const { db, target } = connectFirestore(env);
  const store = new FirestoreStore(db);

  const base = env.SCOUT_BOARD_BASE_URL?.replace(/\/+$/, '');
  const rewrite = base ? (url: string) => `${base}/${url.replace(/^https?:\/\//, '')}` : undefined;
  const { githubLists, atsFeeds } = await loadSources('sources/sources.yaml');
  const configuredBoards = await loadBoards('sources/boards.yaml');
  const http = createHttpClient();
  const resolver = createLinkResolver(rewrite ? { rewrite } : {});

  const deps: PipelineDeps = {
    store,
    lists: (stored) =>
      githubLists.map(
        (config) =>
          new GitHubListSource(config, {
            http,
            resolver,
            knownLinks: knownShortLinks(stored, config.name),
            // Following a short link costs a request, so only Canadian rows are followed.
            shouldResolve: (listing) => hasCanadianLocation(listing.locations),
            ...(base ? { baseUrl: `${base}/raw.githubusercontent.com` } : {}),
          }),
      ),
    configuredBoards,
    boardSources: (boards) =>
      createBoardSources({ boards, feeds: atsFeeds, ...(rewrite ? { rewrite } : {}) }),
    triager: (settings) =>
      new ClaudeTriage({ client: createClaudeClient(), settings, maxWaitMs: DAILY_TRIAGE_WAIT_MS }),
    notifier: new PushNotifier({ messaging: firebaseMessaging(), devices: store.devices }),
    dashboardUrl: env.SCOUT_DASHBOARD_URL ?? null,
    clock: () => new Date(),
    commit: commitOf(env.SCOUT_COMMIT),
    secrets: secretValues(env),
  };
  return { deps, target };
}
