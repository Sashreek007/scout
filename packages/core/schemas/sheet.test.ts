import { describe, expect, it } from 'vitest';
import { draftAnswer as draft, profileAnswer as fromProfile, validSheet } from './examples.fixture';
import { SheetAnswerSchema, SheetSchema } from './sheet';

describe('SheetAnswerSchema', () => {
  it('parses a profile answer and a draft', () => {
    expect(SheetAnswerSchema.parse(fromProfile).evidence).toBe('work_authorization.status');
    expect(SheetAnswerSchema.parse(draft).needsReview).toBe(true);
  });

  it('rejects a factual answer with no evidence', () => {
    expect(SheetAnswerSchema.safeParse({ ...fromProfile, evidence: null }).success).toBe(false);
    expect(
      SheetAnswerSchema.safeParse({ ...fromProfile, source: 'claude_fact', evidence: null })
        .success,
    ).toBe(false);
  });

  it('rejects a draft that skips his review', () => {
    expect(SheetAnswerSchema.safeParse({ ...draft, needsReview: false }).success).toBe(false);
  });

  it('accepts a multi-select value', () => {
    expect(
      SheetAnswerSchema.safeParse({ ...fromProfile, value: ['Toronto', 'Remote'] }).success,
    ).toBe(true);
  });
});

describe('SheetSchema', () => {
  it('parses a sheet', () => {
    expect(SheetSchema.parse(validSheet).answers).toHaveLength(2);
  });

  it('rejects two answers for one field', () => {
    expect(SheetSchema.safeParse({ ...validSheet, answers: [draft, draft] }).success).toBe(false);
  });
});
