import { ListingSchema, type BoardRef } from '@scout/core';
import { startFakeJobBoard, type FakeJobBoard } from '@scout/testkit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHttpClient } from '../http/http-client';
import { FEEDS, feedFor } from './board-feeds.fixture';
import { LeverSource } from './lever-source';

const EQBANK: BoardRef = { ats: 'lever', token: 'eqbank', company: 'EQ Bank' };
const ID = 'c924506b-22ad-4906-aea5-61d9b79163f3';

function posting(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-2222-4333-8444-555555555555',
    text: 'Developer Intern, Summer 2027',
    categories: { location: 'Toronto', allLocations: ['Toronto', 'Montreal'] },
    createdAt: 1793836800000,
    hostedUrl: 'https://jobs.lever.co/acme/11111111-2222-4333-8444-555555555555',
    applyUrl: 'https://jobs.lever.co/acme/11111111-2222-4333-8444-555555555555/apply',
    descriptionPlain: 'Join us.',
    lists: [{ text: 'What you will do', content: '<li>Ship code</li><li>Learn</li>' }],
    additionalPlain: 'Apply by Friday.',
    ...overrides,
  };
}

describe('LeverSource', () => {
  let board: FakeJobBoard;
  beforeAll(async () => {
    board = await startFakeJobBoard();
  });
  afterAll(() => board.close());

  const source = (boards: BoardRef[] = [EQBANK]) =>
    new LeverSource({
      http: createHttpClient({ sleep: () => Promise.resolve() }),
      boards,
      feedUrl: FEEDS.lever,
      rewrite: board.rewrite,
    });
  const acme: BoardRef = { ats: 'lever', token: 'acme', company: null };
  const serve = (rows: unknown[]) => {
    board.script(feedFor('lever', 'acme'), [{ status: 200, body: JSON.stringify(rows) }]);
  };

  it('reads the saved eqbank board: 82 postings, of which 17 are student roles', async () => {
    const batch = await source().fetch();
    expect(batch).toMatchObject({ fetched: 82, invalid: 0, skipped: [] });
    expect(batch.listings).toHaveLength(17);
    for (const listing of batch.listings) expect(() => ListingSchema.parse(listing)).not.toThrow();
    const software = batch.listings.find((l) => l.title === 'Intern - Software Engineer, Winter 2027');
    expect(software).toMatchObject({
      source: 'lever',
      company: 'EQ Bank',
      locations: ['Toronto'],
      rawTerm: 'Winter 2027',
      terms: ['Winter 2027'],
      applyUrl: `https://jobs.lever.co/eqbank/${ID}/apply`,
      sourceUrl: `https://jobs.lever.co/eqbank/${ID}/apply`,
      unresolvedUrl: false,
      postedAt: new Date(1791472812949),
    });
    expect(software?.description).toMatch(/^Join a Challenger\n/);
    expect(software?.description).toContain('The Core Responsibilities of the Job\n');
    expect(software?.description).not.toMatch(/<|&nbsp;|&amp;/);
  });

  it('takes locations from categories.location and categories.allLocations, once each', async () => {
    serve([
      posting(),
      posting({ id: '11111111-2222-4333-8444-000000000002', categories: { location: 'Remote' } }),
      posting({ id: '11111111-2222-4333-8444-000000000003', categories: null }),
    ]);
    const listings = (await source([acme]).fetch()).listings;
    expect(listings.map((l) => l.locations)).toEqual([['Toronto', 'Montreal'], ['Remote'], []]);
  });

  it('joins the description, its lists and the closing text', async () => {
    serve([posting()]);
    const [listing] = (await source([acme]).fetch()).listings;
    expect(listing?.description).toBe(
      'Join us.\n\nWhat you will do\n- Ship code\n- Learn\n\nApply by Friday.',
    );
  });

  it('names the company from the board, or by its token when nothing else is known', async () => {
    serve([posting()]);
    const [listing] = (await source([acme]).fetch()).listings;
    expect(listing?.company).toBe('acme');
  });

  it('keeps only student roles, and counts postings that fail validation', async () => {
    serve([
      posting(),
      posting({ id: '11111111-2222-4333-8444-000000000002', text: 'Director, Internal Audit' }),
      posting({ id: 'not-a-uuid' }),
      posting({ text: '' }),
    ]);
    const batch = await source([acme]).fetch();
    expect(batch).toMatchObject({ fetched: 4, invalid: 2 });
    expect(batch.listings.map((l) => l.title)).toEqual(['Developer Intern, Summer 2027']);
  });
});
