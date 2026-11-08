import { describe, expect, it } from 'vitest';
import { validJob, validProfile } from './schemas/examples.fixture';
import { JobSchema, ProfileSchema, type Job } from './schemas';
import {
  TRIAGE_OUTPUT_SCHEMA,
  TRIAGE_FIRST_RUN_DAYS,
  readTriage,
  selectForTriage,
  triageInput,
  triageInstructions,
} from './triage';

const profile = ProfileSchema.parse(validProfile);
const NOW = new Date('2026-11-07T14:00:00Z');
const job = (overrides: Partial<Job> = {}): Job =>
  JobSchema.parse({ ...validJob, triage: null, ...overrides });

describe('triageInstructions', () => {
  it('is the same text every time for the same profile, so the cached prefix holds', () => {
    expect(triageInstructions(profile)).toBe(triageInstructions(structuredClone(profile)));
  });

  it('is long enough to cache, which Haiku 5.5 does from 512 tokens', () => {
    // About four characters a token.
    expect(triageInstructions(profile).length).toBeGreaterThan(512 * 4);
  });

  it('says what triage needs about him and leaves out contact details and resumes', () => {
    const text = triageInstructions(profile);
    expect(text).toContain('Study permit with a co-op work permit');
    expect(text).toContain('January 2027');
    expect(text).toContain('software engineering intern');
    for (const secret of [
      profile.identity.full_name,
      profile.identity.email,
      profile.identity.phone,
      profile.links.github,
      profile.resumes.default.path,
    ]) {
      expect(text).not.toContain(secret);
    }
  });
});

describe('triageInput', () => {
  it('gives the posting with its text', () => {
    const text = triageInput(job());
    expect(text).toContain('Company: Northwind Robotics');
    expect(text).toContain('Title: Software Developer Intern');
    expect(text).toContain('Build the services behind our warehouse robots.');
  });

  it('says when there is only a title, company and location', () => {
    expect(triageInput(job({ description: null }))).toContain(
      'No posting text: judge from the title, company and location only.',
    );
  });
});

describe('TRIAGE_OUTPUT_SCHEMA', () => {
  it('is a strict JSON schema with only what structured outputs support', () => {
    const text = JSON.stringify(TRIAGE_OUTPUT_SCHEMA);
    expect(TRIAGE_OUTPUT_SCHEMA).toMatchObject({ type: 'object', additionalProperties: false });
    for (const unsupported of ['minimum', 'maximum', 'minLength', 'maxLength', 'maxItems']) {
      expect(text).not.toContain(unsupported);
    }
    expect(TRIAGE_OUTPUT_SCHEMA.required).toEqual([
      'decision',
      'score',
      'reasons',
      'lead',
      'flags',
    ]);
  });
});

describe('readTriage', () => {
  const answer = {
    decision: 'apply',
    score: 82,
    reasons: ['Backend internship in Toronto', 'Go matches mint'],
    lead: 'backend',
    flags: [],
  };

  it('checks the answer with TriageSchema', () => {
    expect(readTriage(JSON.stringify(answer), job())).toEqual(answer);
    expect(() => readTriage('{"decision":"hire"}', job())).toThrow();
    expect(() => readTriage('not json', job())).toThrow();
  });

  it('keeps at most 3 reasons of at most 120 characters, and a score from 0 to 100', () => {
    const long = { ...answer, score: 140, reasons: ['a'.repeat(200), 'b', 'c', 'd'] };
    const triage = readTriage(JSON.stringify(long), job());
    expect(triage.score).toBe(100);
    expect(triage.reasons).toHaveLength(3);
    expect(triage.reasons[0]).toHaveLength(120);
    expect(triage.reasons[0]?.endsWith('…')).toBe(true);
  });

  it('starts the reasons with "Title only" when the posting had no text', () => {
    const triage = readTriage(
      JSON.stringify({ ...answer, reasons: ['x', 'y', 'z'] }),
      job({ description: null }),
    );
    expect(triage.reasons).toEqual(['Title only: no posting text to read', 'x', 'y']);
  });
});

describe('selectForTriage', () => {
  const passed = { passed: true, reasons: [], flags: [], details: {} };
  const failed = { passed: false, reasons: ['role' as const], flags: [], details: {} };
  const triage = {
    decision: 'maybe' as const,
    score: 50,
    reasons: ['ok'],
    lead: 'backend' as const,
    flags: [],
  };

  it('takes jobs that passed the filters and have no triage, newest first', () => {
    const jobs = [
      job({ key: 'a:1', filter: passed, postedAt: new Date('2026-11-01T00:00:00Z') }),
      job({ key: 'a:2', filter: passed, postedAt: new Date('2026-11-05T00:00:00Z') }),
      job({ key: 'a:3', filter: failed }),
      job({ key: 'a:4', filter: passed, triage }),
      job({ key: 'a:5', filter: null }),
      job({ key: 'a:6', filter: passed, active: false }),
    ];
    expect(selectForTriage(jobs, { now: NOW, firstRun: false, max: 60 }).map((j) => j.key)).toEqual(
      ['a:2', 'a:1'],
    );
  });

  it('takes at most maxTriagePerRun', () => {
    const jobs = Array.from({ length: 70 }, (_, i) =>
      job({ key: `a:${String(i)}`, filter: passed }),
    );
    expect(selectForTriage(jobs, { now: NOW, firstRun: false, max: 60 })).toHaveLength(60);
  });

  it(`only takes postings from the last ${String(TRIAGE_FIRST_RUN_DAYS)} days on the first run`, () => {
    const day = 24 * 60 * 60 * 1000;
    const jobs = [
      job({ key: 'a:new', filter: passed, postedAt: new Date(NOW.getTime() - 20 * day) }),
      job({ key: 'a:old', filter: passed, postedAt: new Date(NOW.getTime() - 22 * day) }),
      job({ key: 'a:undated', filter: passed, postedAt: null }),
    ];
    expect(selectForTriage(jobs, { now: NOW, firstRun: true, max: 60 }).map((j) => j.key)).toEqual([
      'a:new',
    ]);
    expect(selectForTriage(jobs, { now: NOW, firstRun: false, max: 60 })).toHaveLength(3);
  });
});
