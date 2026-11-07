import { readFile } from 'node:fs/promises';
import { GitHubListSource, createBoardSources, createHttpClient } from '@scout/adapters';
import {
  ListingSchema,
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

function listing(company: string, applyUrl: string): Listing {
  return ListingSchema.parse({
    source: 'simplify',
    company,
    title: 'Developer Intern',
    locations: ['Toronto, ON, Canada'],
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

describe('collecting the lists and boards from the real config', () => {
  it('polls every board they name through the feeds in sources.yaml, and changes no file', async () => {
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

      // The saved Simplify list names 486 boards, and the stored job adds northwind. vansh's links
      // are short links, which aren't followed here.
      const perAts = (ats: string) => boards.filter((b) => b.ats === ats).length;
      expect([perAts('greenhouse'), perAts('lever'), perAts('ashby')]).toEqual([223, 62, 202]);
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
        ['greenhouse', 17, 2, 221],
        ['lever', 82, 17, 61],
        ['ashby', 124, 3, 201],
      ]);

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
