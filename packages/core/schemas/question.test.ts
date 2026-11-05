import { describe, expect, it } from 'vitest';
import { openQuestion } from './examples.fixture';
import { QuestionSchema } from './question';

describe('QuestionSchema', () => {
  it('parses an open question and an answered one', () => {
    expect(QuestionSchema.parse(openQuestion).status).toBe('open');
    const answered = {
      ...openQuestion,
      status: 'answered',
      answer: 'Yes',
      answeredAt: new Date('2026-11-05T15:00:00Z'),
      remember: true,
    };
    expect(QuestionSchema.parse(answered).answer).toBe('Yes');
  });

  it('parses a live question from a worker', () => {
    const live = {
      ...openQuestion,
      worker: 2,
      tabTitle: 'scout 2 · Northwind Robotics',
      expiresAt: new Date('2026-11-05T20:10:00Z'),
    };
    expect(QuestionSchema.parse(live).worker).toBe(2);
  });

  it('rejects an answered question with no answer', () => {
    expect(QuestionSchema.safeParse({ ...openQuestion, status: 'answered' }).success).toBe(false);
  });

  it('rejects worker 9, since at most 8 run', () => {
    expect(QuestionSchema.safeParse({ ...openQuestion, worker: 9 }).success).toBe(false);
  });
});
