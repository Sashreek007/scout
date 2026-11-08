// The pipeline wired to the saved fixtures: the real sources.yaml and boards.yaml, every request
// sent to the fake job board, and short links never followed. Shared by the unit and emulator tests.
import { GitHubListSource, createBoardSources, createHttpClient } from '@scout/adapters';
import type { Store } from '@scout/core';
import type { FakeJobBoard } from '@scout/testkit';
import { loadBoards } from './config/boards';
import { loadSources } from './config/sources';
import type { PipelineDeps } from './pipeline';
import { knownShortLinks } from './steps/collect';

export async function fixturePipeline(
  store: Store,
  board: FakeJobBoard,
  clock: () => Date,
): Promise<PipelineDeps> {
  const { githubLists, atsFeeds } = await loadSources('sources/sources.yaml');
  const http = createHttpClient({ sleep: () => Promise.resolve() });
  return {
    store,
    lists: (stored) =>
      githubLists.map(
        (config) =>
          new GitHubListSource(config, {
            http,
            baseUrl: `${board.url}/raw.githubusercontent.com`,
            knownLinks: knownShortLinks(stored, config.name),
            shouldResolve: () => false,
          }),
      ),
    configuredBoards: await loadBoards('sources/boards.yaml'),
    boardSources: (boards) =>
      createBoardSources({
        boards,
        feeds: atsFeeds,
        rewrite: board.rewrite,
        sleep: () => Promise.resolve(),
      }),
    clock,
    commit: null,
  };
}

/** A clock that reads `times` in order, then stays on the last one. */
export function clockAt(...times: Date[]): () => Date {
  let i = 0;
  return () => times[Math.min(i++, times.length - 1)] ?? new Date(0);
}
