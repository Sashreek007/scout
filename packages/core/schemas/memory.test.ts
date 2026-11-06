import { describe, expect, it } from 'vitest';
import { validMemory } from './examples.fixture';
import { MemoryEntrySchema } from './memory';

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
