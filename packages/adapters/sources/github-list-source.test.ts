import { ListingSchema } from '@scout/core';
import { startFakeJobBoard, type FakeJobBoard } from '@scout/testkit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHttpClient } from '../http/http-client';
import { createLinkResolver } from '../http/link-resolver';
import { GitHubListSource, type GitHubListConfig, type GitHubListDeps } from './github-list-source';

const SIMPLIFY: GitHubListConfig = {
  name: 'simplify',
  repo: 'SimplifyJobs/Summer2027-Internships',
  path: '.github/scripts/listings.json',
  branch: 'dev',
  fallbackBranch: 'main',
  termField: 'terms',
  resolveShortLinks: false,
  certainYears: {},
};
const VANSH: GitHubListConfig = {
  ...SIMPLIFY,
  name: 'vansh',
  repo: 'vanshb03/Summer2027-Internships',
  termField: 'season',
  resolveShortLinks: true,
  certainYears: { Summer: 2027 },
};
const RAW = 'https://raw.githubusercontent.com';
const listUrl = (config: GitHubListConfig, branch = config.branch) =>
  `${RAW}/${config.repo}/${branch}/${config.path}`;

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    company_name: 'Northwind Robotics',
    title: 'Software Developer Intern',
    locations: ['Toronto, ON, Canada'],
    url: 'https://job-boards.greenhouse.io/northwind/jobs/4100001',
    active: true,
    is_visible: true,
    date_posted: 1793836800,
    terms: ['Winter 2027'],
    season: 'Summer',
    ...overrides,
  };
}

describe('GitHubListSource', () => {
  let board: FakeJobBoard;
  beforeAll(async () => {
    board = await startFakeJobBoard();
  });
  afterAll(() => board.close());

  function source(config: GitHubListConfig, deps: Partial<GitHubListDeps> = {}) {
    return new GitHubListSource(config, {
      http: createHttpClient({ sleep: () => Promise.resolve() }),
      resolver: createLinkResolver({ rewrite: board.rewrite }),
      baseUrl: `${board.url}/raw.githubusercontent.com`,
      ...deps,
    });
  }
  const serve = (config: GitHubListConfig, rows: unknown[]) => {
    board.script(listUrl(config), [{ status: 200, body: JSON.stringify(rows) }]);
  };

  it('reads the saved Simplify list from 2026-11-05: every active, visible row', async () => {
    const batch = await source(SIMPLIFY).fetch();
    expect(batch).toMatchObject({ fetched: 17653, invalid: 0 });
    expect(batch.listings).toHaveLength(5365);
    for (const listing of batch.listings) expect(() => ListingSchema.parse(listing)).not.toThrow();
    const element = batch.listings.find((l) => l.company === 'Element Fleet Management');
    expect(element).toMatchObject({
      source: 'simplify',
      locations: ['Toronto, ON, Canada'],
      rawTerm: 'N/A',
      terms: [],
      unresolvedUrl: false,
      description: null,
    });
    expect(element?.applyUrl).toBe(element?.sourceUrl);
    expect(board.userAgents.at(-1)).toBe('scout/0.1 (personal job search)');
  });

  it('reads the saved vansh list from 2026-11-05', async () => {
    const batch = await source(VANSH, { shouldResolve: () => false }).fetch();
    expect(batch).toMatchObject({ fetched: 3021, invalid: 0 });
    expect(batch.listings).toHaveLength(2193);
    expect(batch.listings.every((l) => l.unresolvedUrl && l.applyUrl === l.sourceUrl)).toBe(true);
  });

  it('keeps only rows that are active and not hidden', async () => {
    serve(SIMPLIFY, [
      row({ id: 'a' }),
      row({ id: 'b', active: false }),
      row({ id: 'c', is_visible: false }),
      row({ id: 'd', is_visible: undefined }),
    ]);
    const batch = await source(SIMPLIFY).fetch();
    expect(batch.fetched).toBe(4);
    expect(batch.listings).toHaveLength(2);
  });

  it('takes Simplify terms as they are, leaving N/A in the raw term only', async () => {
    serve(SIMPLIFY, [
      row({ terms: ['Summer 2027', 'Fall 2027'] }),
      row({ terms: ['N/A'] }),
      row({ terms: [] }),
    ]);
    const [both, unknown, none] = (await source(SIMPLIFY).fetch()).listings;
    expect(both).toMatchObject({ rawTerm: 'Summer 2027, Fall 2027', terms: ['Summer 2027', 'Fall 2027'] });
    expect(unknown).toMatchObject({ rawTerm: 'N/A', terms: [] });
    expect(none).toMatchObject({ rawTerm: null, terms: [] });
  });

  it('keeps vansh seasons raw, and sets a term only when the year is certain', async () => {
    serve(VANSH, [row({ season: 'Summer' }), row({ season: 'Winter' }), row({ season: 'Spring/Summer' })]);
    const listings = (await source(VANSH, { shouldResolve: () => false }).fetch()).listings;
    expect(listings.map((l) => [l.rawTerm, l.terms])).toEqual([
      ['Summer', ['Summer 2027']],
      ['Winter', []],
      ['Spring/Summer', []],
    ]);
  });

  it('follows vansh short links, and keeps the short link when one cannot be followed', async () => {
    serve(VANSH, [row({ url: 'https://go.vansh.nyc/ok1' }), row({ url: 'https://go.vansh.nyc/dead' })]);
    board.script('https://go.vansh.nyc/ok1', [
      { status: 302, headers: { location: 'https://jobs.lever.co/acme/123' } },
    ]);
    board.script('https://go.vansh.nyc/dead', [{ status: 404 }]);
    const [followed, stuck] = (await source(VANSH).fetch()).listings;
    expect(followed).toMatchObject({
      applyUrl: 'https://jobs.lever.co/acme/123',
      sourceUrl: 'https://go.vansh.nyc/ok1',
      unresolvedUrl: false,
    });
    expect(stuck).toMatchObject({
      applyUrl: 'https://go.vansh.nyc/dead',
      sourceUrl: 'https://go.vansh.nyc/dead',
      unresolvedUrl: true,
    });
  });

  it('follows each short link once: links already followed come from the jobs', async () => {
    serve(VANSH, [row({ url: 'https://go.vansh.nyc/known' })]);
    const before = board.requests.length;
    const known = new Map([['https://go.vansh.nyc/known', 'https://jobs.ashbyhq.com/acme/77']]);
    const [listing] = (await source(VANSH, { knownLinks: known }).fetch()).listings;
    expect(listing).toMatchObject({ applyUrl: 'https://jobs.ashbyhq.com/acme/77', unresolvedUrl: false });
    expect(board.requests.slice(before).some((p) => p.startsWith('/go.vansh.nyc'))).toBe(false);
  });

  it('counts and skips rows that fail validation, and carries on', async () => {
    serve(SIMPLIFY, [
      row(),
      row({ title: '' }),
      row({ url: 'not a url' }),
      { surprise: true },
    ]);
    const batch = await source(SIMPLIFY).fetch();
    expect(batch).toMatchObject({ fetched: 4, invalid: 3 });
    expect(batch.listings).toHaveLength(1);
  });

  it('falls back to main when the dev branch is missing', async () => {
    board.script(listUrl(SIMPLIFY), [{ status: 404 }]);
    board.script(listUrl(SIMPLIFY, 'main'), [{ status: 200, body: JSON.stringify([row()]) }]);
    const batch = await source(SIMPLIFY).fetch();
    expect(batch.listings).toHaveLength(1);
  });

  it('fails with the source named when the list cannot be read at all', async () => {
    board.script(listUrl(SIMPLIFY), Array.from({ length: 4 }, () => ({ status: 503 })));
    await expect(source(SIMPLIFY).fetch()).rejects.toThrow(/simplify: .*answered 503/);
  });

  it('fails when the file is not a list of rows', async () => {
    serve(SIMPLIFY, { rows: [] } as unknown as unknown[]);
    await expect(source(SIMPLIFY).fetch()).rejects.toThrow('simplify: listings.json is not a list');
  });
});
