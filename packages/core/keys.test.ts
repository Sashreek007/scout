import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { contentHash, listingKey, normalizeName, sha256Hex } from './keys';
import { JobKeySchema } from './schemas';

const listing = (overrides: Partial<Parameters<typeof listingKey>[0]> = {}) => ({
  source: 'simplify',
  company: 'Royal Bank of Canada',
  title: 'AI Engineer Co-op - Global Equities',
  applyUrl: 'https://rbc.wd3.myworkdayjobs.com/RBCEARLYTALENT1/job/TORONTO-Ontario-Canada/1',
  sourceUrl: 'https://rbc.wd3.myworkdayjobs.com/RBCEARLYTALENT1/job/TORONTO-Ontario-Canada/1',
  ...overrides,
});

describe('normalizeName', () => {
  it('drops case, accents and punctuation and collapses spaces', () => {
    expect(normalizeName('  Société Générale (Montréal)  ')).toBe('societe generale montreal');
    expect(normalizeName('Software Engineer Intern - Winter 2027!')).toBe(
      'software engineer intern winter 2027',
    );
    expect(normalizeName('Co-op/Intern')).toBe('co op intern');
  });
});

describe('sha256Hex', () => {
  it('is the lowercase hex SHA-256 of the UTF-8 text', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('listingKey', () => {
  it('is {ats}:{board}:{postingId} for a Greenhouse, Lever or Ashby apply URL', async () => {
    expect(
      await listingKey(
        listing({ applyUrl: 'https://boards.greenhouse.io/TribalScale/jobs/4726999006?gh_jid=1' }),
      ),
    ).toEqual({
      key: 'greenhouse:tribalscale:4726999006',
      ats: 'greenhouse',
      boardToken: 'tribalscale',
      postingId: '4726999006',
    });
    expect(
      (
        await listingKey(
          listing({
            applyUrl: 'https://jobs.lever.co/EQBank/11111111-2222-4333-8444-555555555555/apply',
          }),
        )
      ).key,
    ).toBe('lever:EQBank:11111111-2222-4333-8444-555555555555');
    expect(
      (
        await listingKey(
          listing({
            applyUrl:
              'https://jobs.ashbyhq.com/cohere/AAAAAAAA-2222-4333-8444-555555555555/application',
          }),
        )
      ).key,
    ).toBe('ashby:cohere:aaaaaaaa-2222-4333-8444-555555555555');
  });

  it('gives a board posting the same key whichever list or board names it', async () => {
    const urls = [
      'https://job-boards.greenhouse.io/northwind/jobs/4100001',
      'https://boards.greenhouse.io/Northwind/jobs/4100001?gh_src=simplify',
    ];
    const keys = await Promise.all(
      urls.map(
        async (applyUrl, i) => (await listingKey(listing({ applyUrl, source: `s${i}` }))).key,
      ),
    );
    expect(new Set(keys)).toEqual(new Set(['greenhouse:northwind:4100001']));
  });

  it('is {source}:{hash} otherwise, the hash covering the company, title and listed link', async () => {
    const key = await listingKey(listing());
    expect(key.key).toMatch(/^simplify:[0-9a-f]{16}$/);
    expect(key).toMatchObject({ ats: 'workday', boardToken: null, postingId: null });
    expect(
      (await listingKey(listing({ applyUrl: 'https://careers.amd.com/jobs/90301' }))).ats,
    ).toBe('other');

    // Case, accents and punctuation in the company and title don't change it.
    expect(
      (
        await listingKey(
          listing({ company: 'ROYAL BANK OF CANADA', title: 'AI Engineer Co-op, Global Equities' }),
        )
      ).key,
    ).toBe(key.key);
    // Another posting with the same title, listed under its own link, keeps its own key. The saved
    // lists have 41 such pairs in Canada, like Pinterest's Winter and Fall "Software Engineer Intern".
    const other = await listingKey(
      listing({
        sourceUrl: 'https://rbc.wd3.myworkdayjobs.com/rbcglobal1/job/TORONTO-Ontario-Canada/1',
      }),
    );
    expect(other.key).not.toBe(key.key);
  });

  it('keys a short link by the link the list gave, whether or not it was followed', async () => {
    const short = listing({
      source: 'vansh',
      applyUrl: 'https://go.vansh.nyc/G3',
      sourceUrl: 'https://go.vansh.nyc/G3',
    });
    const followed = await listingKey({
      ...short,
      applyUrl: 'https://manulife.wd3.myworkdayjobs.com/MFCJH_Jobs/job/Waterloo/JR1',
    });
    expect(followed.key).toBe((await listingKey(short)).key);
    expect(followed.key).toMatch(/^vansh:/);
  });

  it('never contains "/" and is always a valid document ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.webUrl(),
        async (company, title, url) => {
          const { key } = await listingKey(
            listing({ company, title, applyUrl: url, sourceUrl: url }),
          );
          expect(key).not.toContain('/');
          expect(JobKeySchema.safeParse(key).success).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('is the same every time for the same listing', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), fc.string(), async (company, title) => {
        const a = await listingKey(listing({ company: `${company}x`, title: `${title}y` }));
        const b = await listingKey(listing({ company: `${company}x`, title: `${title}y` }));
        expect(a).toEqual(b);
      }),
    );
  });
});

describe('contentHash', () => {
  const content = {
    title: 'Software Developer Intern',
    locations: ['Toronto, ON, Canada', 'Ottawa, ON, Canada'],
    terms: ['Winter 2027', 'Summer 2027'],
    description: 'Build the services behind our warehouse robots.',
  };

  it('is the SHA-256 of the normalized title, sorted locations, terms and description', async () => {
    expect(await contentHash(content)).toBe(
      await sha256Hex(
        JSON.stringify([
          'software developer intern',
          ['Ottawa, ON, Canada', 'Toronto, ON, Canada'],
          ['Summer 2027', 'Winter 2027'],
          'Build the services behind our warehouse robots.',
        ]),
      ),
    );
  });

  it('ignores order, case and spacing that say nothing new', async () => {
    const same = {
      title: 'software  developer intern',
      locations: ['Ottawa, ON, Canada', ' Toronto, ON,  Canada'],
      terms: ['Summer 2027', 'Winter 2027'],
      description: 'Build the services\nbehind our warehouse robots. ',
    };
    expect(await contentHash(same)).toBe(await contentHash(content));
  });

  it('changes when the title, a location, a term or the description changes', async () => {
    const base = await contentHash(content);
    for (const change of [
      { title: 'Software Developer Intern II' },
      { locations: ['Toronto, ON, Canada'] },
      { terms: ['Winter 2027'] },
      { description: 'Build robots.' },
      { description: null },
    ]) {
      expect(await contentHash({ ...content, ...change })).not.toBe(base);
    }
  });
});
