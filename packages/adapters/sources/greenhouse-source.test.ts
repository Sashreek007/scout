import { DESCRIPTION_MAX_BYTES, ListingSchema, type BoardRef } from '@scout/core';
import { startFakeJobBoard, type FakeJobBoard } from '@scout/testkit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHttpClient } from '../http/http-client';
import { FEEDS, feedFor } from './board-feeds.fixture';
import { GreenhouseSource } from './greenhouse-source';

const TRIBALSCALE: BoardRef = { ats: 'greenhouse', token: 'tribalscale', company: null };

function job(overrides: Record<string, unknown> = {}) {
  return {
    id: 7000001,
    title: 'Software Developer Co-op (Winter 2027)',
    company_name: 'Acme',
    location: { name: 'Waterloo, Ontario, Canada' },
    absolute_url: 'https://job-boards.greenhouse.io/acme/jobs/7000001',
    first_published: '2026-11-01T09:00:00-05:00',
    updated_at: '2026-11-02T09:00:00-05:00',
    content: '&lt;p&gt;Build things &amp;amp; ship them.&lt;/p&gt;',
    ...overrides,
  };
}

describe('GreenhouseSource', () => {
  let board: FakeJobBoard;
  beforeAll(async () => {
    board = await startFakeJobBoard();
  });
  afterAll(() => board.close());

  const source = (boards: BoardRef[] = [TRIBALSCALE]) =>
    new GreenhouseSource({
      http: createHttpClient({ sleep: () => Promise.resolve() }),
      boards,
      feedUrl: FEEDS.greenhouse,
      rewrite: board.rewrite,
    });
  const serve = (token: string, jobs: unknown[]) => {
    board.script(feedFor('greenhouse', token), [{ status: 200, body: JSON.stringify({ jobs }) }]);
  };

  it('reads the saved tribalscale board: 15 postings, of which 1 is a student role', async () => {
    const batch = await source().fetch();
    expect(batch).toMatchObject({ fetched: 15, invalid: 0, skipped: [] });
    expect(batch.listings).toHaveLength(1);
    const [coop] = batch.listings;
    expect(() => ListingSchema.parse(coop)).not.toThrow();
    expect(coop).toMatchObject({
      source: 'greenhouse',
      company: 'TribalScale',
      title: 'Agile Software Engineer - Co-op',
      locations: ['Toronto, Ontario, Canada'],
      rawTerm: null,
      terms: [],
      applyUrl: 'https://job-boards.greenhouse.io/tribalscale/jobs/4687337006',
      sourceUrl: 'https://job-boards.greenhouse.io/tribalscale/jobs/4687337006',
      unresolvedUrl: false,
      postedAt: new Date('2026-06-09T15:36:42-04:00'),
    });
    expect(coop?.description).toMatch(/^Shape the Future with TribalScale\n/);
    expect(coop?.description).not.toMatch(/<|&lt;|&amp;|&nbsp;/);
  });

  it('takes the location from location.name and the term from the title', async () => {
    serve('acme', [job()]);
    const [listing] = (await source([{ ats: 'greenhouse', token: 'acme', company: null }]).fetch())
      .listings;
    expect(listing).toMatchObject({
      company: 'Acme',
      locations: ['Waterloo, Ontario, Canada'],
      rawTerm: 'Winter 2027',
      terms: ['Winter 2027'],
      description: 'Build things & ship them.',
    });
  });

  it('builds the apply URL from the board, even when the posting lives on the company site', async () => {
    serve('acme', [job({ absolute_url: 'https://www.acme.com/careers?gh_jid=7000001' })]);
    const [listing] = (await source([{ ats: 'greenhouse', token: 'acme', company: null }]).fetch())
      .listings;
    expect(listing).toMatchObject({
      applyUrl: 'https://job-boards.greenhouse.io/acme/jobs/7000001',
      sourceUrl: 'https://www.acme.com/careers?gh_jid=7000001',
    });
  });

  it('keeps a posting whose own link is malformed, since scout builds the apply URL', async () => {
    serve('acme', [job({ absolute_url: '/careers/7000001' })]);
    const batch = await source([{ ats: 'greenhouse', token: 'acme', company: null }]).fetch();
    expect(batch.invalid).toBe(0);
    expect(batch.listings[0]).toMatchObject({
      applyUrl: 'https://job-boards.greenhouse.io/acme/jobs/7000001',
      sourceUrl: 'https://job-boards.greenhouse.io/acme/jobs/7000001',
    });
  });

  it('keeps only student roles', async () => {
    serve('acme', [
      job({ id: 1, title: 'Software Engineering Intern' }),
      job({ id: 2, title: 'Senior Software Engineer' }),
      job({ id: 3, title: 'Internal Tools Engineer' }),
      job({ id: 4, title: 'Platform Engineer, Summer 2027' }),
    ]);
    const batch = await source([{ ats: 'greenhouse', token: 'acme', company: null }]).fetch();
    expect(batch.fetched).toBe(4);
    expect(batch.listings.map((l) => l.title)).toEqual([
      'Software Engineering Intern',
      'Platform Engineer, Summer 2027',
    ]);
  });

  it('falls back to the known company name, then the token, and copes with missing fields', async () => {
    serve('acme', [
      job({ id: 1, company_name: null, location: null, content: null, first_published: null }),
    ]);
    serve('beta', [
      job({ id: 2, company_name: undefined, first_published: null, updated_at: 'not a date' }),
    ]);
    const [acme, beta] = (
      await source([
        { ats: 'greenhouse', token: 'acme', company: 'Acme Robotics' },
        { ats: 'greenhouse', token: 'beta', company: null },
      ]).fetch()
    ).listings;
    expect(acme).toMatchObject({
      company: 'Acme Robotics',
      locations: [],
      description: null,
      postedAt: new Date('2026-11-02T09:00:00-05:00'),
    });
    expect(beta).toMatchObject({ company: 'beta', postedAt: null });
  });

  it('caps the description at 50 KB', async () => {
    serve('acme', [job({ content: `&lt;p&gt;${'é'.repeat(40_000)}&lt;/p&gt;` })]);
    const [listing] = (await source([{ ats: 'greenhouse', token: 'acme', company: null }]).fetch())
      .listings;
    expect(new TextEncoder().encode(listing?.description ?? '').length).toBe(DESCRIPTION_MAX_BYTES);
  });

  it('counts and skips postings that fail validation', async () => {
    serve('acme', [job(), job({ id: 'abc' }), job({ title: '' }), { surprise: true }]);
    const batch = await source([{ ats: 'greenhouse', token: 'acme', company: null }]).fetch();
    expect(batch).toMatchObject({ fetched: 4, invalid: 3 });
    expect(batch.listings).toHaveLength(1);
  });
});
