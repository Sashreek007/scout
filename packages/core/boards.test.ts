import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { boardApplyUrl, boardsToPoll, canonicalToken, parseBoardUrl } from './boards';
import { JobSchema, ListingSchema, type Job, type Listing } from './schemas';

const UUID = 'a20b80c5-53c4-4c34-b8de-c6d9208994a6';

describe('parseBoardUrl', () => {
  it('reads job-boards.greenhouse.io/{token}/jobs/{id}', () => {
    expect(parseBoardUrl('https://job-boards.greenhouse.io/tribalscale/jobs/4687337006')).toEqual({
      ats: 'greenhouse',
      token: 'tribalscale',
      postingId: '4687337006',
    });
  });

  it('reads boards.greenhouse.io/{token}/jobs/{id}', () => {
    expect(parseBoardUrl('https://boards.greenhouse.io/tribalscale/jobs/4687337006')).toEqual({
      ats: 'greenhouse',
      token: 'tribalscale',
      postingId: '4687337006',
    });
  });

  it('reads jobs.lever.co/{token}/{id}, with or without /apply', () => {
    const posting = { ats: 'lever', token: 'eqbank', postingId: UUID };
    expect(parseBoardUrl(`https://jobs.lever.co/eqbank/${UUID}`)).toEqual(posting);
    expect(parseBoardUrl(`https://jobs.lever.co/eqbank/${UUID}/apply`)).toEqual(posting);
  });

  it('reads jobs.ashbyhq.com/{token}/{id}, with or without /application', () => {
    const posting = { ats: 'ashby', token: 'cohere', postingId: UUID };
    expect(parseBoardUrl(`https://jobs.ashbyhq.com/cohere/${UUID}`)).toEqual(posting);
    expect(parseBoardUrl(`https://jobs.ashbyhq.com/cohere/${UUID}/application?embed=js`)).toEqual(
      posting,
    );
  });

  it('ignores the query string and a trailing slash', () => {
    expect(
      parseBoardUrl('https://job-boards.greenhouse.io/tribalscale/jobs/4687337006/?gh_jid=1&utm=x'),
    ).toMatchObject({ token: 'tribalscale', postingId: '4687337006' });
  });

  it('lowercases Greenhouse and Ashby tokens, whose APIs ignore case, and keeps Lever case', () => {
    expect(parseBoardUrl('https://job-boards.greenhouse.io/TribalScale/jobs/1')?.token).toBe(
      'tribalscale',
    );
    expect(parseBoardUrl(`https://jobs.ashbyhq.com/Cohere/${UUID.toUpperCase()}`)).toMatchObject({
      token: 'cohere',
      postingId: UUID,
    });
    // api.lever.co answers 404 for EQBank but 200 for eqbank, and the reverse for CesiumAstro.
    expect(parseBoardUrl(`https://jobs.lever.co/CesiumAstro/${UUID}`)?.token).toBe('CesiumAstro');
  });

  it('decodes a token with spaces, like an Ashby board named "Hippocratic AI"', () => {
    expect(parseBoardUrl(`https://jobs.ashbyhq.com/Hippocratic%20AI/${UUID}`)?.token).toBe(
      'hippocratic ai',
    );
  });

  it.each([
    ['a board page with no posting', 'https://job-boards.greenhouse.io/tribalscale'],
    ['the embedded form', 'https://boards.greenhouse.io/embed/job_app?for=acme&token=123'],
    ['the EU Greenhouse host', 'https://job-boards.eu.greenhouse.io/acme/jobs/123'],
    ['the EU Lever host', `https://jobs.eu.lever.co/acme/${UUID}/apply`],
    ['a Greenhouse id that is not a number', 'https://job-boards.greenhouse.io/acme/jobs/abc'],
    ['a Lever id that is not a UUID', 'https://jobs.lever.co/acme/123'],
    ['an Ashby page after the posting', `https://jobs.ashbyhq.com/acme/${UUID}/apply`],
    ['extra path', 'https://job-boards.greenhouse.io/acme/jobs/123/extra'],
    ['a Workday posting', 'https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternal/job/123'],
    ['a short link', 'https://go.vansh.nyc/abc'],
    ['a token with a slash in it', 'https://jobs.ashbyhq.com/a%2Fb/' + UUID],
    ['a token that is not valid escaping', 'https://jobs.ashbyhq.com/a%E0%A4%A/' + UUID],
    ['another scheme', `ftp://jobs.lever.co/acme/${UUID}`],
    ['not a URL', 'jobs.lever.co/acme'],
  ])('ignores %s', (_, url) => {
    expect(parseBoardUrl(url)).toBeNull();
  });

  it('reads every Greenhouse, Lever and Ashby posting in a list of real apply URLs', () => {
    const urls = [
      'https://job-boards.greenhouse.io/co-op_intern/jobs/7000001',
      `https://jobs.lever.co/thea.energy/${UUID}/apply`,
      `https://jobs.ashbyhq.com/mistral.ai/${UUID}/application`,
    ];
    expect(urls.map((url) => parseBoardUrl(url)?.token)).toEqual([
      'co-op_intern',
      'thea.energy',
      'mistral.ai',
    ]);
  });
});

describe('boardApplyUrl', () => {
  it('builds the link each board uses for its application', () => {
    expect(boardApplyUrl({ ats: 'greenhouse', token: 'tribalscale', postingId: '42' })).toBe(
      'https://job-boards.greenhouse.io/tribalscale/jobs/42',
    );
    expect(boardApplyUrl({ ats: 'lever', token: 'eqbank', postingId: UUID })).toBe(
      `https://jobs.lever.co/eqbank/${UUID}/apply`,
    );
    expect(boardApplyUrl({ ats: 'ashby', token: 'hippocratic ai', postingId: UUID })).toBe(
      `https://jobs.ashbyhq.com/hippocratic%20ai/${UUID}/application`,
    );
  });

  it('reads back as the same posting', () => {
    const token = fc.stringMatching(/^[a-z0-9][a-z0-9._-]{0,30}$/);
    const posting = fc.oneof(
      fc.record({
        ats: fc.constant('greenhouse' as const),
        token,
        postingId: fc.stringMatching(/^[1-9]\d{0,12}$/),
      }),
      fc.record({
        ats: fc.constantFrom('lever' as const, 'ashby' as const),
        token,
        postingId: fc.uuid(),
      }),
    );
    fc.assert(
      fc.property(posting, (p) => {
        expect(parseBoardUrl(boardApplyUrl(p))).toEqual(p);
      }),
    );
  });
});

describe('canonicalToken', () => {
  it('lowercases where the board ignores case, and refuses tokens that are not safe', () => {
    expect(canonicalToken('greenhouse', 'TribalScale')).toBe('tribalscale');
    expect(canonicalToken('lever', 'CesiumAstro')).toBe('CesiumAstro');
    expect(canonicalToken('ashby', ' Cohere ')).toBe('cohere');
    expect(canonicalToken('lever', 'a/b')).toBeNull();
    expect(canonicalToken('lever', '')).toBeNull();
    expect(canonicalToken('lever', 'x'.repeat(101))).toBeNull();
  });
});

function aListing(overrides: Partial<Listing> = {}): Listing {
  return ListingSchema.parse({
    source: 'simplify',
    company: 'Cohere',
    title: 'Machine Learning Intern',
    locations: ['Toronto, ON, Canada'],
    rawTerm: null,
    terms: [],
    applyUrl: `https://jobs.ashbyhq.com/cohere/${UUID}/application`,
    sourceUrl: `https://jobs.ashbyhq.com/cohere/${UUID}/application`,
    unresolvedUrl: false,
    postedAt: null,
    description: null,
    ...overrides,
  });
}

function aStoredJob(overrides: Partial<Job>): Job {
  const now = new Date('2026-11-05T14:00:00Z');
  return JobSchema.parse({
    key: 'greenhouse:shopify:1',
    ats: 'greenhouse',
    boardToken: 'shopify',
    postingId: '1',
    company: 'Shopify',
    title: 'Developer Intern',
    locations: ['Ottawa, ON, Canada'],
    rawTerm: null,
    terms: [],
    applyUrl: 'https://job-boards.greenhouse.io/shopify/jobs/1',
    unresolvedUrl: false,
    postedAt: null,
    description: null,
    sources: [{ name: 'greenhouse', url: null }],
    contentHash: 'a'.repeat(64),
    filter: null,
    triage: null,
    active: true,
    missedRuns: 0,
    firstSeenAt: now,
    lastSeenAt: now,
    ...overrides,
  });
}

describe('boardsToPoll', () => {
  const configured = { greenhouse: ['tribalscale'], lever: ['eqbank'], ashby: ['cohere'] };

  it("is the union of the file, the tokens in this run's listings and the tokens on stored jobs", () => {
    const boards = boardsToPoll({
      configured,
      listings: [
        aListing(),
        aListing({
          company: 'Wealthsimple',
          applyUrl: `https://jobs.lever.co/wealthsimple/${UUID}/apply`,
        }),
        aListing({ company: 'NVIDIA', applyUrl: 'https://nvidia.wd5.myworkdayjobs.com/x/job/1' }),
      ],
      jobs: [
        aStoredJob({}),
        aStoredJob({ key: 'workday:x', ats: 'workday', boardToken: 'nvidia', company: 'NVIDIA' }),
        aStoredJob({ key: 'other:x', ats: 'other', boardToken: null }),
      ],
    });
    expect(boards).toEqual([
      { ats: 'greenhouse', token: 'shopify', company: 'Shopify' },
      { ats: 'greenhouse', token: 'tribalscale', company: null },
      { ats: 'lever', token: 'eqbank', company: null },
      { ats: 'lever', token: 'wealthsimple', company: 'Wealthsimple' },
      { ats: 'ashby', token: 'cohere', company: 'Cohere' },
    ]);
  });

  it('lists each board once, however its token was written', () => {
    const boards = boardsToPoll({
      configured: { greenhouse: ['TribalScale'], lever: [], ashby: [] },
      listings: [
        aListing({
          company: 'TribalScale',
          applyUrl: 'https://boards.greenhouse.io/tribalscale/jobs/1',
        }),
      ],
      jobs: [aStoredJob({ boardToken: 'TRIBALSCALE', company: 'TribalScale Inc.' })],
    });
    expect(boards).toEqual([{ ats: 'greenhouse', token: 'tribalscale', company: 'TribalScale' }]);
  });

  it('skips listings whose short link could not be followed', () => {
    const boards = boardsToPoll({
      configured: { greenhouse: [], lever: [], ashby: [] },
      listings: [
        aListing({ applyUrl: 'https://go.vansh.nyc/x', sourceUrl: 'https://go.vansh.nyc/x' }),
      ],
      jobs: [],
    });
    expect(boards).toEqual([]);
  });
});
