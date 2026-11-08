import { readFile } from 'node:fs/promises';
import { GitHubListSource, createBoardSources, createHttpClient } from '@scout/adapters';
import {
  ListingSchema,
  hasCanadianLocation,
  type BoardRef,
  type JobSource,
  type Listing,
  type SourceBatch,
} from '@scout/core';
import { aJob, startFakeJobBoard } from '@scout/testkit';
import { describe, expect, it } from 'vitest';
import { loadBoards } from '../config/boards';
import { loadSources } from '../config/sources';
import { collect, collectAll, knownShortLinks } from './collect';

const batch: SourceBatch = { listings: [], fetched: 3, invalid: 1, skipped: [] };
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

function listing(
  company: string,
  applyUrl: string,
  locations: string[] = ['Toronto, ON, Canada'],
): Listing {
  return ListingSchema.parse({
    source: 'simplify',
    company,
    title: 'Developer Intern',
    locations,
    rawTerm: null,
    terms: [],
    applyUrl,
    sourceUrl: applyUrl,
    unresolvedUrl: false,
    postedAt: null,
    description: null,
  });
}
const listed = (id: string, listings: Listing[]): JobSource => ({
  id,
  fetch: () => Promise.resolve({ listings, fetched: listings.length, invalid: 0, skipped: [] }),
});

describe('collectAll', () => {
  it('reads the lists, then polls boards.yaml, the boards the listings name and the stored ones', async () => {
    let polled: BoardRef[] = [];
    const { outcomes, boards } = await collectAll({
      lists: [
        listed('simplify', [
          listing(
            'Wealthsimple',
            'https://jobs.lever.co/wealthsimple/11111111-2222-4333-8444-555555555555/apply',
          ),
          listing('Workday Co', 'https://acme.wd1.myworkdayjobs.com/x/job/1'),
        ]),
        broken('vansh'),
      ],
      configuredBoards: { greenhouse: ['tribalscale'], lever: [], ashby: ['cohere'] },
      jobs: [aJob({ boardToken: 'northwind' })],
      boardSources: (found) => {
        polled = found;
        return [ok('greenhouse'), broken('lever')];
      },
    });
    expect(boards).toEqual([
      { ats: 'greenhouse', token: 'northwind', company: 'Northwind Robotics' },
      { ats: 'greenhouse', token: 'tribalscale', company: null },
      { ats: 'lever', token: 'wealthsimple', company: 'Wealthsimple' },
      { ats: 'ashby', token: 'cohere', company: null },
    ]);
    expect(polled).toEqual(boards);
    expect(outcomes.map((o) => [o.source, o.ok])).toEqual([
      ['simplify', true],
      ['vansh', false],
      ['greenhouse', true],
      ['lever', false],
    ]);
  });

  it('never fetches a board that only a listing or stored job outside Canada points at', async () => {
    const board = await startFakeJobBoard();
    try {
      const { atsFeeds } = await loadSources('sources/sources.yaml');
      const { outcomes, boards } = await collectAll({
        lists: [
          listed('simplify', [
            // Both real rows from the saved Simplify list. Figma's board is never fetched.
            listing('Figma', 'https://boards.greenhouse.io/figma/jobs/6152695004', [
              'London, UK',
              'NYC',
              'SF',
            ]),
            listing(
              'Equitable Bank',
              'https://jobs.lever.co/eqbank/11111111-2222-4333-8444-555555555555/apply',
            ),
          ]),
        ],
        configuredBoards: { greenhouse: [], lever: [], ashby: [] },
        jobs: [
          aJob({
            key: 'greenhouse:scaleai:4730845005',
            boardToken: 'scaleai',
            company: 'Scale AI',
            locations: ['SF', 'Remote in USA'],
          }),
        ],
        boardSources: (found) =>
          createBoardSources({ boards: found, feeds: atsFeeds, rewrite: board.rewrite }),
      });
      expect(boards).toEqual([{ ats: 'lever', token: 'eqbank', company: 'Equitable Bank' }]);
      expect(board.requestUrls).toEqual(['/api.lever.co/v0/postings/eqbank?mode=json']);
      expect(
        outcomes.map((o) => (o.ok ? [o.source, o.batch.listings.length, o.batch.skipped] : o)),
      ).toEqual([
        ['simplify', 2, []],
        ['greenhouse', 0, []],
        ['lever', 17, []],
        ['ashby', 0, []],
      ]);
    } finally {
      await board.close();
    }
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
      // The rows in Canada, by the rule that picks the boards to poll and that #8 filters with.
      expect(
        outcomes.map((o) =>
          o.ok ? o.batch.listings.filter((l) => hasCanadianLocation(l.locations)).length : o,
        ),
      ).toEqual([462, 288]);
    } finally {
      await board.close();
    }
  });
});

describe('collecting the lists and boards from the real config', () => {
  it('polls the boards in boards.yaml and the ones Canadian listings name, and changes no file', async () => {
    const board = await startFakeJobBoard();
    const boardsFile = await readFile('sources/boards.yaml', 'utf8');
    try {
      const { githubLists, atsFeeds } = await loadSources('sources/sources.yaml');
      const http = createHttpClient({ sleep: () => Promise.resolve() });
      const { outcomes, boards } = await collectAll({
        lists: githubLists.map(
          (config) =>
            new GitHubListSource(config, {
              http,
              baseUrl: `${board.url}/raw.githubusercontent.com`,
              shouldResolve: () => false,
            }),
        ),
        configuredBoards: await loadBoards('sources/boards.yaml'),
        jobs: [aJob()],
        boardSources: (found) =>
          createBoardSources({ boards: found, feeds: atsFeeds, rewrite: board.rewrite }),
      });

      // The saved Simplify list names 486 boards, but only 45 of them through a posting in Canada,
      // and those include the three in boards.yaml. The stored job, in Toronto, adds northwind.
      // vansh's links are short links, which aren't followed here.
      const perAts = (ats: string) => boards.filter((b) => b.ats === ats).length;
      expect([perAts('greenhouse'), perAts('lever'), perAts('ashby')]).toEqual([24, 10, 12]);
      // Lever's feed doesn't name the company, so the name comes from the Simplify listing.
      expect(boards).toContainEqual({ ats: 'lever', token: 'eqbank', company: 'Equitable Bank' });
      expect(boards).toContainEqual({
        ats: 'greenhouse',
        token: 'northwind',
        company: 'Northwind Robotics',
      });

      // Only tribalscale, eqbank, cohere and northwind have saved copies; every other board is a
      // 404 here, which is noted and doesn't fail its source.
      expect(
        outcomes.map((o) =>
          o.ok ? [o.source, o.batch.fetched, o.batch.listings.length, o.batch.skipped.length] : o,
        ),
      ).toEqual([
        ['simplify', 17653, 5365, 0],
        ['vansh', 3021, 2193, 0],
        ['greenhouse', 17, 2, 22],
        ['lever', 82, 17, 9],
        ['ashby', 124, 3, 11],
      ]);

      // Each board is fetched once, and nothing else is: Figma and Scale AI, whose saved listings
      // are all in the US or the UK, are never asked.
      const feedRequests = board.requestUrls.filter((url) => !url.startsWith('/raw.'));
      expect(feedRequests).toHaveLength(boards.length);
      expect(new Set(feedRequests).size).toBe(boards.length);
      expect(feedRequests.filter((url) => /\/(?:figma|scaleai)\//.test(url))).toEqual([]);

      const lever = outcomes.find((o) => o.source === 'lever');
      expect(lever?.ok && lever.batch.listings.every((l) => l.company === 'Equitable Bank')).toBe(
        true,
      );

      expect(board.requestUrls).toEqual(
        expect.arrayContaining([
          '/boards-api.greenhouse.io/v1/boards/tribalscale/jobs?content=true',
          '/api.lever.co/v0/postings/eqbank?mode=json',
          '/api.ashbyhq.com/posting-api/job-board/cohere?includeCompensation=true',
        ]),
      );
      expect(await readFile('sources/boards.yaml', 'utf8')).toBe(boardsFile);
    } finally {
      await board.close();
    }
  });
});

describe('knownShortLinks', () => {
  it('maps each short link a list followed to the apply URL stored on its job', () => {
    const followed = aJob({
      applyUrl: 'https://jobs.lever.co/acme/123',
      sources: [
        { name: 'lever', url: 'https://acme.example/careers/123' },
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
    // Lever's own link to the careers page isn't a short link, so it isn't there.
    expect(knownShortLinks([followed, stuck], 'vansh')).toEqual(
      new Map([['https://go.vansh.nyc/ok1', 'https://jobs.lever.co/acme/123']]),
    );
  });
});
