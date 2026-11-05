import { describe, expect, it } from 'vitest';
import { ActorSchema, STAGES, StageEventSchema, StageSchema } from './stage';

describe('StageSchema', () => {
  it('accepts every stage from section 3', () => {
    expect(STAGES).toHaveLength(16);
    for (const stage of STAGES) expect(StageSchema.parse(stage)).toBe(stage);
  });

  it('rejects an unknown or differently spelled stage', () => {
    expect(StageSchema.safeParse('needs-answers').success).toBe(false);
    expect(StageSchema.safeParse('Applied').success).toBe(false);
  });
});

describe('ActorSchema', () => {
  it('knows the four actors', () => {
    expect(ActorSchema.options).toEqual(['pipeline', 'agent', 'you', 'mail']);
  });
});

describe('StageEventSchema', () => {
  const event = {
    from: 'review',
    to: 'approved',
    by: 'you',
    at: new Date('2026-11-05T20:00:00Z'),
    detail: null,
  };

  it('parses a move, and the creation event with no from', () => {
    expect(StageEventSchema.parse(event)).toEqual(event);
    expect(StageEventSchema.safeParse({ ...event, from: null, to: 'queued' }).success).toBe(true);
  });

  it('rejects an unknown actor and extra fields', () => {
    expect(StageEventSchema.safeParse({ ...event, by: 'claude' }).success).toBe(false);
    expect(StageEventSchema.safeParse({ ...event, note: 'x' }).success).toBe(false);
  });
});
