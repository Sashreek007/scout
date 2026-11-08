import { describe, expect, it } from 'vitest';
import { validJob } from './examples.fixture';
import { FilterResultSchema, JobSchema, TriageSchema } from './job';

describe('JobSchema', () => {
  it('parses a triaged job found by two sources', () => {
    expect(JobSchema.parse(validJob).sources).toHaveLength(2);
  });

  it('rejects a job with no source', () => {
    expect(JobSchema.safeParse({ ...validJob, sources: [] }).success).toBe(false);
  });

  it('rejects a key with a slash', () => {
    expect(JobSchema.safeParse({ ...validJob, key: 'greenhouse/northwind' }).success).toBe(false);
  });
});

describe('FilterResultSchema', () => {
  it('accepts a dropped job with its reasons, flags and what each found', () => {
    const dropped = {
      passed: false,
      reasons: ['location', 'values'],
      flags: ['term_unknown'],
      details: { location: 'not in Canada: Remote in USA', term_unknown: 'no term given' },
    };
    expect(FilterResultSchema.parse(dropped)).toEqual(dropped);
  });

  it('loads a result stored before #8 gave details, with none', () => {
    const older = { passed: false, reasons: ['location'], flags: [] };
    expect(FilterResultSchema.parse(older)).toEqual({ ...older, details: {} });
  });

  it('rejects a detail for a code that does not exist', () => {
    const result = { passed: true, reasons: [], flags: [], details: { weather: 'rain' } };
    expect(FilterResultSchema.safeParse(result).success).toBe(false);
  });

  it('rejects a pass that still has reasons, or a failure without one', () => {
    expect(
      FilterResultSchema.safeParse({ passed: true, reasons: ['role'], flags: [] }).success,
    ).toBe(false);
    expect(FilterResultSchema.safeParse({ passed: false, reasons: [], flags: [] }).success).toBe(
      false,
    );
  });
});

describe('TriageSchema', () => {
  it('rejects a score over 100, a fourth reason, and a reason over 120 characters', () => {
    const triage = validJob.triage;
    expect(TriageSchema.safeParse({ ...triage, score: 101 }).success).toBe(false);
    expect(TriageSchema.safeParse({ ...triage, reasons: ['a', 'b', 'c', 'd'] }).success).toBe(
      false,
    );
    expect(TriageSchema.safeParse({ ...triage, reasons: ['x'.repeat(121)] }).success).toBe(false);
  });
});
