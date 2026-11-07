import { ListingSchema, type BoardRef } from '@scout/core';
import { startFakeJobBoard, type FakeJobBoard } from '@scout/testkit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHttpClient } from '../http/http-client';
import { AshbySource } from './ashby-source';
import { FEEDS, feedFor } from './board-feeds.fixture';

const COHERE: BoardRef = { ats: 'ashby', token: 'cohere', company: 'Cohere' };
const ID = '73bd3e2b-6597-4124-b64b-1e5dbc32e785';

function job(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-2222-4333-8444-555555555555',
    title: 'Machine Learning Intern',
    location: 'Toronto',
    secondaryLocations: [{ location: 'Montreal', address: {} }],
    isRemote: false,
    isListed: true,
    publishedAt: '2026-11-01T12:00:00.000+00:00',
    jobUrl: 'https://jobs.ashbyhq.com/acme/11111111-2222-4333-8444-555555555555',
    applyUrl: 'https://jobs.ashbyhq.com/acme/11111111-2222-4333-8444-555555555555/application',
    descriptionPlain: 'Train models.',
    ...overrides,
  };
}

describe('AshbySource', () => {
  let board: FakeJobBoard;
  beforeAll(async () => {
    board = await startFakeJobBoard();
  });
  afterAll(() => board.close());

  const source = (boards: BoardRef[] = [COHERE]) =>
    new AshbySource({
      http: createHttpClient({ sleep: () => Promise.resolve() }),
      boards,
      feedUrl: FEEDS.ashby,
      rewrite: board.rewrite,
    });
  const acme: BoardRef = { ats: 'ashby', token: 'acme', company: 'Acme' };
  const serve = (jobs: unknown[]) => {
    board.script(feedFor('ashby', 'acme'), [
      { status: 200, body: JSON.stringify({ apiVersion: 1, jobs }) },
    ]);
  };

  it('reads the saved cohere board: 124 postings, of which 3 are student roles', async () => {
    const batch = await source().fetch();
    expect(batch).toMatchObject({ fetched: 124, invalid: 0, skipped: [] });
    expect(batch.listings.map((l) => l.title)).toEqual([
      'Research Internship (Winter 2027)',
      'Machine Learning Intern/Co-op  (Winter 2027)',
      'Revenue Operations Intern (Winter, 2027)',
    ]);
    for (const listing of batch.listings) expect(() => ListingSchema.parse(listing)).not.toThrow();
    expect(batch.listings[0]).toMatchObject({
      source: 'ashby',
      company: 'Cohere',
      locations: [
        'Canada',
        'San Francisco',
        'Europe',
        'London',
        'United States',
        'United Kingdom',
        'Toronto',
        'Montreal',
        'Remote',
      ],
      rawTerm: 'Winter 2027',
      terms: ['Winter 2027'],
      applyUrl: `https://jobs.ashbyhq.com/cohere/${ID}/application`,
      sourceUrl: `https://jobs.ashbyhq.com/cohere/${ID}/application`,
      unresolvedUrl: false,
      postedAt: new Date('2026-05-01T20:26:46.572Z'),
    });
    expect(batch.listings[0]?.description).toMatch(/^WHO ARE WE\?\n/);
    expect(batch.listings[2]).toMatchObject({ rawTerm: 'Winter, 2027', terms: ['Winter 2027'] });
  });

  it('takes locations from location and secondaryLocations, and adds Remote when isRemote', async () => {
    serve([
      job(),
      job({ id: '11111111-2222-4333-8444-000000000002', isRemote: true }),
      job({
        id: '11111111-2222-4333-8444-000000000003',
        location: 'Remote - Canada',
        secondaryLocations: [],
        isRemote: true,
      }),
      job({ id: '11111111-2222-4333-8444-000000000004', location: null, secondaryLocations: null }),
    ]);
    const listings = (await source([acme]).fetch()).listings;
    expect(listings.map((l) => l.locations)).toEqual([
      ['Toronto', 'Montreal'],
      ['Toronto', 'Montreal', 'Remote'],
      ['Remote - Canada'],
      [],
    ]);
  });

  it('skips postings the board does not list, and keeps only student roles', async () => {
    serve([
      job(),
      job({ id: '11111111-2222-4333-8444-000000000002', isListed: false }),
      job({ id: '11111111-2222-4333-8444-000000000003', title: 'Senior Engineer' }),
    ]);
    const batch = await source([acme]).fetch();
    expect(batch).toMatchObject({ fetched: 3, invalid: 0 });
    expect(batch.listings).toHaveLength(1);
  });

  it('reads the HTML description when there is no plain one', async () => {
    serve([job({ descriptionPlain: ' ', descriptionHtml: '<p>Train <b>models</b>.</p>' })]);
    const [listing] = (await source([acme]).fetch()).listings;
    expect(listing?.description).toBe('Train models.');
  });
});
