import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  MISSES_TO_CLOSE,
  buildJobs,
  missedJobs,
  wasRead,
  type BuildJobsInput,
  type Coverage,
} from './jobs';
import { contentHash } from './keys';
import { DESCRIPTION_MAX_BYTES, JobSchema, ListingSchema, type Job, type Listing } from './schemas';

const NOW = new Date('2026-11-07T14:00:00Z');
const YESTERDAY = new Date('2026-11-06T14:00:00Z');
const PRIORITY = ['greenhouse', 'lever', 'ashby', 'simplify', 'vansh'];

function aListing(overrides: Partial<Listing> = {}): Listing {
  const applyUrl = overrides.applyUrl ?? 'https://job-boards.greenhouse.io/northwind/jobs/4100001';
  return ListingSchema.parse({
    source: 'simplify',
    company: 'Northwind Robotics',
    title: 'Software Developer Intern',
    locations: ['Toronto, ON, Canada'],
    rawTerm: 'Winter 2027',
    terms: ['Winter 2027'],
    applyUrl,
    sourceUrl: applyUrl,
    unresolvedUrl: false,
    postedAt: new Date('2026-11-01T00:00:00Z'),
    description: null,
    ...overrides,
  });
}

const board = (overrides: Partial<Listing> = {}) =>
  aListing({
    source: 'greenhouse',
    title: 'Software Developer Intern (Winter 2027)',
    sourceUrl: 'https://northwind.example/careers/4100001',
    description: 'Build the services behind our warehouse robots, in Go and TypeScript.',
    ...overrides,
  });

/** A vansh listing whose short link couldn't be followed. */
const shortLink = (path: string, overrides: Partial<Listing> = {}) =>
  aListing({
    source: 'vansh',
    applyUrl: `https://go.vansh.nyc/${path}`,
    sourceUrl: `https://go.vansh.nyc/${path}`,
    unresolvedUrl: true,
    locations: ['Toronto, Canada'],
    rawTerm: 'Winter',
    terms: [],
    ...overrides,
  });

const workday = (overrides: Partial<Listing> = {}) =>
  aListing({
    company: 'Manulife Financial',
    title: 'Software Engineering Co-op',
    applyUrl: 'https://manulife.wd3.myworkdayjobs.com/MFCJH_Jobs/job/Toronto/JR100',
    ...overrides,
  });

/** Everything was read this run, including the Northwind board. */
const ALL_READ: Coverage = {
  sourcesRead: new Set(PRIORITY),
  boardsRead: new Set(['greenhouse:northwind']),
};

function run(listings: Listing[], more: Partial<BuildJobsInput> = {}) {
  return buildJobs({
    listings,
    stored: [],
    coverage: ALL_READ,
    priority: PRIORITY,
    now: NOW,
    ...more,
  });
}

/** A job as an earlier run stored it. */
async function stored(listings: Listing[], overrides: Partial<Job> = {}): Promise<Job> {
  const { jobs } = await run(listings, { now: YESTERDAY });
  const job = jobs[0]?.job;
  if (!job) throw new Error('nothing was built');
  return JobSchema.parse({ ...job, ...overrides });
}

describe('wasRead', () => {
  const coverage: Coverage = {
    sourcesRead: new Set(['simplify', 'greenhouse']),
    boardsRead: new Set(['greenhouse:northwind']),
  };

  it('counts a list as read when its source was', () => {
    expect(wasRead(coverage, 'simplify', null)).toBe(true);
    expect(wasRead(coverage, 'vansh', null)).toBe(false);
  });

  it('counts a board as read only when its own feed was', () => {
    expect(wasRead(coverage, 'greenhouse', 'northwind')).toBe(true);
    expect(wasRead(coverage, 'greenhouse', 'acme')).toBe(false);
    expect(wasRead(coverage, 'lever', 'northwind')).toBe(false);
  });

  it('never counts a link he pasted as read, because no source lists it', () => {
    expect(wasRead({ ...coverage, sourcesRead: new Set(['you']) }, 'you', null)).toBe(false);
  });
});

describe('buildJobs: one job per posting', () => {
  it('merges listings that share a key, and keeps both source names', async () => {
    const { jobs } = await run([
      aListing(),
      board({ locations: ['Toronto, ON, Canada', 'Remote in Canada'] }),
    ]);
    expect(jobs).toHaveLength(1);
    const job = jobs[0]!.job;
    expect(job).toMatchObject({
      key: 'greenhouse:northwind:4100001',
      ats: 'greenhouse',
      boardToken: 'northwind',
      postingId: '4100001',
      // The board's own title and text win over the list's.
      title: 'Software Developer Intern (Winter 2027)',
      description: 'Build the services behind our warehouse robots, in Go and TypeScript.',
      locations: ['Toronto, ON, Canada', 'Remote in Canada'],
      terms: ['Winter 2027'],
      applyUrl: 'https://job-boards.greenhouse.io/northwind/jobs/4100001',
      sources: [
        { name: 'greenhouse', url: 'https://northwind.example/careers/4100001' },
        { name: 'simplify', url: 'https://job-boards.greenhouse.io/northwind/jobs/4100001' },
      ],
    });
  });

  it('builds the same jobs whatever order the listings come in', async () => {
    const listings = [
      aListing(),
      board(),
      shortLink('a1'),
      workday(),
      workday({ source: 'vansh', applyUrl: 'https://go.vansh.nyc/w1', unresolvedUrl: true }),
      aListing({ applyUrl: 'https://jobs.lever.co/acme/11111111-2222-4333-8444-555555555555' }),
    ];
    const expected = (await run(listings)).jobs;
    await fc.assert(
      fc.asyncProperty(fc.shuffledSubarray(listings, { minLength: listings.length }), async (l) => {
        expect((await run(l)).jobs).toEqual(expected);
      }),
      { numRuns: 30 },
    );
  });

  it('caps the description at 50 KB even if a source sent more', async () => {
    const long = `${'é'.repeat(DESCRIPTION_MAX_BYTES)} end`;
    // The listing schema already refuses this, so it is built without it.
    const { jobs } = await run([{ ...board(), description: long }]);
    const description = jobs[0]!.job.description!;
    expect(new TextEncoder().encode(description).length).toBeLessThanOrEqual(DESCRIPTION_MAX_BYTES);
    expect(long.startsWith(description)).toBe(true);
  });

  it('stores nothing outside Canada, and counts it', async () => {
    const result = await run([
      aListing({
        applyUrl: 'https://boards.greenhouse.io/figma/jobs/6152695004',
        company: 'Figma',
        locations: ['London, UK', 'NYC', 'SF'],
      }),
      aListing(),
    ]);
    expect(result.jobs.map((j) => j.job.key)).toEqual(['greenhouse:northwind:4100001']);
    expect(result.outsideCanada).toBe(1);
  });

  it('keeps updating a stored job even after it moves outside Canada', async () => {
    const before = await stored([aListing()]);
    const { jobs, outsideCanada } = await run([aListing({ locations: ['Remote in USA'] })], {
      stored: [before],
    });
    expect(jobs.map((j) => [j.change, j.job.locations])).toEqual([['changed', ['Remote in USA']]]);
    expect(outsideCanada).toBe(0);
  });
});

describe('buildJobs: the second pass', () => {
  it('merges a vansh listing with an unresolved short link into its Greenhouse job', async () => {
    const { jobs } = await run([board(), shortLink('nw1')]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.job).toMatchObject({
      key: 'greenhouse:northwind:4100001',
      applyUrl: 'https://job-boards.greenhouse.io/northwind/jobs/4100001',
      unresolvedUrl: false,
      locations: ['Toronto, ON, Canada', 'Toronto, Canada'],
      sources: [
        { name: 'greenhouse', url: 'https://northwind.example/careers/4100001' },
        { name: 'vansh', url: 'https://go.vansh.nyc/nw1' },
      ],
    });
  });

  it('merges it into the stored Greenhouse job on a day the board lists nothing new', async () => {
    const before = await stored([board(), shortLink('nw1')]);
    const { jobs } = await run([shortLink('nw1')], {
      stored: [before],
      coverage: { ...ALL_READ, boardsRead: new Set() },
    });
    expect(jobs.map((j) => [j.job.key, j.change])).toEqual([
      ['greenhouse:northwind:4100001', 'unchanged'],
    ]);
  });

  it('merges a short link seen for the first time into a stored job the board left out', async () => {
    const before = await stored([board()]);
    const { jobs } = await run([shortLink('nw9')], {
      stored: [before],
      coverage: { ...ALL_READ, boardsRead: new Set() },
    });
    expect(jobs.map((j) => [j.job.key, j.job.sources.map((s) => s.name)])).toEqual([
      ['greenhouse:northwind:4100001', ['greenhouse', 'vansh']],
    ]);
  });

  it('sends a listing to the board job when two stored jobs hold its link', async () => {
    const onItsOwn = await stored([shortLink('nw1')]);
    const merged = await stored([board(), shortLink('nw1')]);
    const { jobs } = await run([board(), shortLink('nw1')], { stored: [onItsOwn, merged] });
    expect(jobs.map((j) => [j.job.key, j.job.sources.map((s) => s.name)])).toEqual([
      ['greenhouse:northwind:4100001', ['greenhouse', 'vansh']],
    ]);
  });

  it('merges the same posting from two lists when neither link is on a board', async () => {
    const { jobs } = await run([
      workday(),
      workday({
        source: 'vansh',
        applyUrl: 'https://go.vansh.nyc/G3',
        unresolvedUrl: true,
        locations: ['Toronto, Canada'],
        terms: [],
        rawTerm: 'Winter',
      }),
    ]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.job.key).toMatch(/^simplify:/);
    expect(jobs[0]!.job.sources.map((s) => s.name)).toEqual(['simplify', 'vansh']);
    expect(jobs[0]!.job.applyUrl).toBe(
      'https://manulife.wd3.myworkdayjobs.com/MFCJH_Jobs/job/Toronto/JR100',
    );
  });

  it('reads "Remote in Canada" and "Remote" as one place', async () => {
    // Solink's real rows: Simplify writes "Remote in Canada", vansh "Remote" and "Canada".
    const solink = { company: 'Solink', title: 'Software Engineer Co-op - Agents' };
    const { jobs } = await run([
      workday({ ...solink, locations: ['Ottawa, ON, Canada', 'Remote in Canada'] }),
      shortLink('s1', { ...solink, locations: ['Remote', 'Canada'] }),
    ]);
    expect(jobs).toHaveLength(1);
  });

  it('keeps the stored key when the other list is the one that is new', async () => {
    const first = await stored([
      workday({ source: 'vansh', applyUrl: 'https://go.vansh.nyc/G3', unresolvedUrl: true }),
    ]);
    const { jobs } = await run(
      [
        workday(),
        workday({ source: 'vansh', applyUrl: 'https://go.vansh.nyc/G3', unresolvedUrl: true }),
      ],
      { stored: [first] },
    );
    expect(jobs.map((j) => j.job.key)).toEqual([first.key]);
    expect(jobs[0]!.job.sources.map((s) => s.name)).toEqual(['simplify', 'vansh']);
  });

  it('needs the company, the title and a location to match', async () => {
    for (const different of [
      { company: 'Northwind Logistics' },
      { title: 'Data Analyst Intern' },
      { locations: ['Vancouver, Canada'] },
    ]) {
      const { jobs } = await run([board(), shortLink('nw1', different)]);
      expect(jobs).toHaveLength(2);
    }
  });

  it('never merges postings for different seasons', async () => {
    const { jobs } = await run([board(), shortLink('nw2', { rawTerm: 'Fall' })]);
    expect(jobs).toHaveLength(2);
  });

  it('never merges two listings from the same source, which are two postings', async () => {
    // Real rows from the saved Simplify list: two AMD requisitions with one title in one city.
    const amd = (id: string, terms: string[]) =>
      aListing({
        company: 'AMD',
        title: 'Graphics Software Engineer Intern/Co-op',
        locations: ['Markham, ON, Canada'],
        terms,
        rawTerm: terms.join(', '),
        applyUrl: `https://careers.amd.com/jobs/${id}?icims=1`,
      });
    const { jobs } = await run([
      amd('90305', ['Summer 2027']),
      amd('91359', ['Winter 2027', 'Summer 2027', 'Fall 2027']),
    ]);
    expect(jobs).toHaveLength(2);
  });

  it('merges a posting from a list into a board job with the same company, title and city', async () => {
    const { jobs } = await run([
      workday(),
      workday({
        source: 'greenhouse',
        applyUrl: 'https://job-boards.greenhouse.io/manulife/jobs/77',
      }),
    ]);
    expect(jobs.map((j) => [j.job.key, j.job.sources.map((s) => s.name)])).toEqual([
      ['greenhouse:manulife:77', ['greenhouse', 'simplify']],
    ]);
  });

  it('leaves a listing on its own when two jobs could be it', async () => {
    const posting = (id: string) =>
      workday({
        source: 'greenhouse',
        applyUrl: `https://job-boards.greenhouse.io/manulife/jobs/${id}`,
      });
    const { jobs } = await run([
      posting('77'),
      posting('78'),
      workday(),
      shortLink('m1', { company: 'Manulife Financial', title: 'Software Engineering Co-op' }),
    ]);
    expect(jobs).toHaveLength(4);
  });
});

describe('buildJobs: new, changed and unchanged', () => {
  it('creates a new job with firstSeenAt, untriaged and active', async () => {
    const { jobs } = await run([board()]);
    expect(jobs[0]!.change).toBe('new');
    expect(jobs[0]!.job).toMatchObject({
      firstSeenAt: NOW,
      lastSeenAt: NOW,
      active: true,
      missedRuns: 0,
      filter: null,
      triage: null,
    });
    expect(jobs[0]!.job.contentHash).toBe(await contentHash(jobs[0]!.job));
  });

  const triaged = {
    filter: { passed: true, reasons: [], flags: [], details: {} },
    triage: {
      decision: 'apply' as const,
      score: 82,
      reasons: ['Backend role in Toronto'],
      lead: 'backend' as const,
      flags: [],
    },
  };

  it('updates a job whose content changed and clears its triage', async () => {
    const before = await stored([board()], triaged);
    const { jobs } = await run([board({ description: 'Now in Rust.' })], { stored: [before] });
    expect(jobs[0]!.change).toBe('changed');
    expect(jobs[0]!.job).toMatchObject({
      description: 'Now in Rust.',
      firstSeenAt: YESTERDAY,
      lastSeenAt: NOW,
      filter: null,
      triage: null,
    });
    expect(jobs[0]!.job.contentHash).not.toBe(before.contentHash);
  });

  it('only marks a job seen again when its content is the same', async () => {
    const before = await stored([board()], triaged);
    const { jobs } = await run([board()], { stored: [before] });
    expect(jobs).toEqual([{ change: 'unchanged', job: { ...before, lastSeenAt: NOW } }]);
  });

  it('keeps the stored posting when one of its sources could not be read this run', async () => {
    const before = await stored([board(), aListing()], triaged);
    // The Northwind board timed out today, so only the Simplify row is here.
    const { jobs } = await run([aListing({ title: 'Software Dev Intern' })], {
      stored: [before],
      coverage: { ...ALL_READ, boardsRead: new Set() },
    });
    expect(jobs).toEqual([{ change: 'unchanged', job: { ...before, lastSeenAt: NOW } }]);
  });

  it('drops a source that was read and no longer lists the job', async () => {
    const before = await stored([board(), aListing()]);
    const { jobs } = await run([board()], { stored: [before] });
    expect(jobs[0]!.job.sources.map((s) => s.name)).toEqual(['greenhouse']);
    expect(jobs[0]!.change).toBe('unchanged');
  });
});

describe('buildJobs: a job seen again', () => {
  it('resets missedRuns, and a job that comes back is active again', async () => {
    const before = await stored([board()], { missedRuns: 2, active: false });
    const { jobs } = await run([board()], { stored: [before] });
    expect(jobs[0]!.job).toMatchObject({ missedRuns: 0, active: true });
  });

  it('resets them too when one of its sources could not be read', async () => {
    const before = await stored([board(), aListing()], { missedRuns: 1 });
    const { jobs } = await run([aListing()], {
      stored: [before],
      coverage: { ...ALL_READ, boardsRead: new Set() },
    });
    expect(jobs[0]!.job.missedRuns).toBe(0);
  });
});

describe('missedJobs', () => {
  const missed = (jobs: Job[], coverage: Coverage = ALL_READ, seen: string[] = []) =>
    missedJobs({ stored: jobs, seen: new Set(seen), coverage });

  it('counts a run that read every source and listed it nowhere as a miss', async () => {
    const job = await stored([board(), aListing()]);
    expect(missed([job])).toEqual([{ job: { ...job, missedRuns: 1 }, becameInactive: false }]);
  });

  it(`makes a job inactive at ${String(MISSES_TO_CLOSE)} misses`, async () => {
    const job = await stored([board()], { missedRuns: 2 });
    expect(missed([job])).toEqual([
      { job: { ...job, missedRuns: 3, active: false }, becameInactive: true },
    ]);
  });

  it('does not count a run where one of its sources could not be read', async () => {
    const job = await stored([board(), aListing()]);
    expect(missed([job], { ...ALL_READ, boardsRead: new Set() })).toEqual([]);
    expect(missed([job], { ...ALL_READ, sourcesRead: new Set(['greenhouse']) })).toEqual([]);
  });

  it('leaves jobs seen this run, jobs already inactive and his own links alone', async () => {
    const seen = await stored([board()]);
    const gone = await stored([aListing({ applyUrl: 'https://jobs.lever.co/acme/x' })], {
      active: false,
      missedRuns: 3,
    });
    const pasted = await stored([board()], {
      key: 'other:pasted',
      sources: [{ name: 'you', url: 'https://acme.example/careers/1' }],
    });
    expect(missed([seen, gone, pasted], ALL_READ, [seen.key])).toEqual([]);
  });
});
