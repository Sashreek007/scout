import { GitHubListSource, createHttpClient } from '@scout/adapters';
import type { JobSource, SourceBatch } from '@scout/core';
import { aJob, startFakeJobBoard } from '@scout/testkit';
import { describe, expect, it } from 'vitest';
import { loadSources } from '../config/sources';
import { collect, knownShortLinks } from './collect';

const batch: SourceBatch = { listings: [], fetched: 3, invalid: 1 };
const ok = (id: string): JobSource => ({ id, fetch: () => Promise.resolve(batch) });
const broken = (id: string): JobSource => ({
  id,
  fetch: () => Promise.reject(new Error(`${id}: https://example.com timed out after 30000 ms`)),
});

describe('collect', () => {
  it('reads every source and carries on when one fails', async () => {
    const outcomes = await collect([ok('simplify'), broken('vansh'), ok('greenhouse')]);
    expect(outcomes).toEqual([
      { source: 'simplify', ok: true, batch },
      { source: 'vansh', ok: false, error: 'vansh: https://example.com timed out after 30000 ms' },
      { source: 'greenhouse', ok: true, batch },
    ]);
  });
});

describe('collecting from the real sources.yaml', () => {
  it('reads both saved lists from 2026-11-05 through the fake job board', async () => {
    const board = await startFakeJobBoard();
    try {
      const { githubLists } = await loadSources('sources/sources.yaml');
      const http = createHttpClient({ sleep: () => Promise.resolve() });
      const sources = githubLists.map(
        (config) =>
          new GitHubListSource(config, {
            http,
            baseUrl: `${board.url}/raw.githubusercontent.com`,
            shouldResolve: () => false,
          }),
      );
      const outcomes = await collect(sources);
      expect(
        outcomes.map((o) => (o.ok ? [o.source, o.batch.fetched, o.batch.listings.length] : o)),
      ).toEqual([
        ['simplify', 17653, 5365],
        ['vansh', 3021, 2193],
      ]);
    } finally {
      await board.close();
    }
  });
});

describe('knownShortLinks', () => {
  it('maps each followed short link to the apply URL stored on its job', () => {
    const followed = aJob({
      applyUrl: 'https://jobs.lever.co/acme/123',
      sources: [
        { name: 'vansh', url: 'https://go.vansh.nyc/ok1' },
        { name: 'simplify', url: 'https://jobs.lever.co/acme/123' },
      ],
    });
    const stuck = aJob({
      key: 'vansh:abc',
      applyUrl: 'https://go.vansh.nyc/dead',
      unresolvedUrl: true,
      sources: [{ name: 'vansh', url: 'https://go.vansh.nyc/dead' }],
    });
    expect(knownShortLinks([followed, stuck])).toEqual(
      new Map([['https://go.vansh.nyc/ok1', 'https://jobs.lever.co/acme/123']]),
    );
  });
});
