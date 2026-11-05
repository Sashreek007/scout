import { describe, expect, it } from 'vitest';
import {
  DESCRIPTION_MAX_BYTES,
  DescriptionSchema,
  JobKeySchema,
  Sha256Schema,
  TermSchema,
  TimestampSchema,
} from './common';

describe('TimestampSchema', () => {
  it('keeps a Date and reads an ISO string with an offset as a Date', () => {
    const date = new Date('2026-11-05T14:00:00Z');
    expect(TimestampSchema.parse(date)).toEqual(date);
    expect(TimestampSchema.parse('2026-11-05T07:00:00-07:00')).toEqual(date);
  });

  it('rejects an invalid date and a bare date string', () => {
    expect(TimestampSchema.safeParse(new Date('nope')).success).toBe(false);
    expect(TimestampSchema.safeParse('2026-11-05').success).toBe(false);
  });
});

describe('JobKeySchema', () => {
  it('accepts board keys and fallback keys', () => {
    expect(JobKeySchema.parse('greenhouse:tribalscale:4726999006')).toBe(
      'greenhouse:tribalscale:4726999006',
    );
    expect(JobKeySchema.safeParse('simplify:3f2a9c').success).toBe(true);
  });

  it.each(['', 'greenhouse/tribalscale/1', '.', '..', '__name__'])('rejects %j', (key) => {
    expect(JobKeySchema.safeParse(key).success).toBe(false);
  });
});

describe('Sha256Schema', () => {
  it('accepts a lowercase hex digest only', () => {
    expect(Sha256Schema.safeParse('a'.repeat(64)).success).toBe(true);
    expect(Sha256Schema.safeParse('A'.repeat(64)).success).toBe(false);
    expect(Sha256Schema.safeParse('a'.repeat(63)).success).toBe(false);
  });
});

describe('TermSchema', () => {
  it('accepts a season and year', () => {
    expect(TermSchema.safeParse('Winter 2027').success).toBe(true);
  });

  it('rejects anything else', () => {
    expect(TermSchema.safeParse('W27').success).toBe(false);
    expect(TermSchema.safeParse('Summer').success).toBe(false);
  });
});

describe('DescriptionSchema', () => {
  it('caps posting text at 50 KB, counted in bytes', () => {
    expect(DescriptionSchema.safeParse('a'.repeat(DESCRIPTION_MAX_BYTES)).success).toBe(true);
    expect(DescriptionSchema.safeParse('a'.repeat(DESCRIPTION_MAX_BYTES + 1)).success).toBe(false);
    // é is two bytes in UTF-8, so half as many characters already reach the cap.
    expect(DescriptionSchema.safeParse('é'.repeat(DESCRIPTION_MAX_BYTES / 2 + 1)).success).toBe(
      false,
    );
  });
});
