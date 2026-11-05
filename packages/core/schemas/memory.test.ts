import { describe, expect, it } from 'vitest';
import { validMemory } from './examples.fixture';
import { MemoryEntrySchema, MemorySeedSchema } from './memory';

describe('MemoryEntrySchema', () => {
  it('parses a remembered answer', () => {
    expect(MemoryEntrySchema.parse(validMemory).timesUsed).toBe(3);
  });

  it('fills the defaults for a new entry', () => {
    const fresh = MemoryEntrySchema.parse({
      questionKey: validMemory.questionKey,
      question: validMemory.question,
      answer: validMemory.answer,
      source: 'answers.yaml',
    });
    expect(fresh).toMatchObject({ kind: 'fact', timesUsed: 0, lastUsedAt: null });
  });

  it('rejects a key that is not a SHA-256', () => {
    expect(
      MemoryEntrySchema.safeParse({ ...validMemory, questionKey: 'how-did-you-hear' }).success,
    ).toBe(false);
  });
});

describe('MemorySeedSchema', () => {
  it('reads an answers.yaml entry, defaulting kind to fact', () => {
    const seed = MemorySeedSchema.parse({
      question: 'Are you willing to work in office 3 days a week?',
      answer: 'Yes',
      source: 'chat 2026-11-05',
    });
    expect(seed).toEqual({
      question: 'Are you willing to work in office 3 days a week?',
      answer: 'Yes',
      kind: 'fact',
      source: 'chat 2026-11-05',
    });
  });

  it('rejects an entry with no answer, or with a key of its own', () => {
    expect(MemorySeedSchema.safeParse({ question: 'Q?', source: 'x' }).success).toBe(false);
    expect(
      MemorySeedSchema.safeParse({ question: 'Q?', answer: 'A', source: 'x', questionKey: 'k' })
        .success,
    ).toBe(false);
  });
});
