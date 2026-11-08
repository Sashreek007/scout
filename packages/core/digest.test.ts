import { describe, expect, it } from 'vitest';
import { buildDigest, digestNotice, failuresIn } from './digest';
import { validJob, validProfile } from './schemas/examples.fixture';
import { JobSchema, type Job, type RunError, type Triage } from './schemas';

const AT = new Date('2026-11-07T14:03:00Z');
const triaged = (
  key: string,
  decision: Triage['decision'],
  score: number,
  overrides: Partial<Job> = {},
) =>
  JobSchema.parse({
    ...validJob,
    key,
    triage: {
      decision,
      score,
      reasons: [`Reason for ${key}`, 'Second'],
      lead: 'backend',
      flags: [],
    },
    ...overrides,
  });
const error = (step: string, target: string | null, status: number | null = null): RunError => ({
  step,
  target,
  message: 'it broke',
  status,
  at: AT,
});
const none = { questions: 0, sheets: 0 };

describe('buildDigest', () => {
  it('lists the new apply and maybe jobs, best score first, with what each line needs', () => {
    const digest = buildDigest({
      triaged: [
        triaged('a:1', 'maybe', 55),
        triaged('a:2', 'skip', 99),
        triaged('a:3', 'apply', 88, {
          company: 'TechInsights',
          title: 'Software Development Co-op',
          locations: ['Ottawa, ON, Canada', 'Remote'],
        }),
      ],
      errors: [],
      waiting: none,
    });
    expect(digest.lines).toEqual([
      {
        jobKey: 'a:3',
        company: 'TechInsights',
        title: 'Software Development Co-op',
        location: 'Ottawa, ON, Canada',
        decision: 'apply',
        score: 88,
        reason: 'Reason for a:3',
      },
      expect.objectContaining({ jobKey: 'a:1', decision: 'maybe', score: 55 }) as unknown,
    ]);
    expect(digest.matches).toBe(2);
  });

  it('lists at most 10 but counts them all', () => {
    const jobs = Array.from({ length: 14 }, (_, i) => triaged(`a:${String(i)}`, 'maybe', 40 + i));
    const digest = buildDigest({ triaged: jobs, errors: [], waiting: none });
    expect(digest.lines).toHaveLength(10);
    expect(digest.lines[0]?.score).toBe(53);
    expect(digest.title).toBe('14 new matches');
  });

  it('says what is waiting and names what failed, in one short line', () => {
    const digest = buildDigest({
      triaged: Array.from({ length: 9 }, (_, i) => triaged(`a:${String(i)}`, 'apply', 80)),
      errors: [error('collect', 'vansh'), error('triage', 'a:9')],
      waiting: { questions: 4, sheets: 1 },
    });
    expect(digest.title).toBe(
      '9 new matches, 4 questions waiting, 1 sheet to review, vansh, triage failed',
    );
    expect(digest.failures).toEqual(['vansh', 'triage']);
  });

  it('still has a line when nothing is new, so a missing notification means no run', () => {
    expect(buildDigest({ triaged: [], errors: [], waiting: none }).title).toBe('No new matches');
    expect(
      buildDigest({
        triaged: [triaged('a:1', 'skip', 3)],
        errors: [],
        waiting: { questions: 1, sheets: 0 },
      }).title,
    ).toBe('No new matches, 1 question waiting');
  });

  it('carries job details only: nothing from his profile or his answers', () => {
    const digest = buildDigest({
      triaged: [triaged('a:1', 'apply', 90)],
      errors: [],
      waiting: none,
    });
    const text = JSON.stringify(digest);
    for (const value of [
      validProfile.identity.full_name,
      validProfile.identity.email,
      validProfile.identity.phone,
    ]) {
      expect(text).not.toContain(value);
    }
    expect(Object.keys(digest.lines[0] ?? {}).sort()).toEqual([
      'company',
      'decision',
      'jobKey',
      'location',
      'reason',
      'score',
      'title',
    ]);
  });
});

describe('failuresIn', () => {
  it('leaves out boards that answered 404, which are gone rather than broken', () => {
    expect(
      failuresIn([error('collect', 'greenhouse:acme', 404), error('collect', 'lever:x', 503)]),
    ).toEqual(['lever:x']);
  });

  it('counts more than three failed boards instead of naming them', () => {
    const boards = ['a', 'b', 'c', 'd'].map((b) => error('collect', `greenhouse:${b}`, null));
    expect(failuresIn(boards)).toEqual(['4 boards']);
  });

  it('names a failed run and a failed step once each', () => {
    expect(
      failuresIn([error('triage', 'a:1'), error('triage', 'a:2'), error('run', null)]),
    ).toEqual(['triage', 'the run']);
  });
});

describe('digestNotice', () => {
  it('is one short line that opens Today', () => {
    const digest = buildDigest({
      triaged: [triaged('a:1', 'apply', 90)],
      errors: [],
      waiting: none,
    });
    expect(digestNotice(digest, 'https://scout.example.app/')).toEqual({
      kind: 'digest',
      title: '1 new match',
      body: null,
      url: 'https://scout.example.app/today',
    });
    expect(digestNotice(digest, null).url).toBe('/today');
  });
});
