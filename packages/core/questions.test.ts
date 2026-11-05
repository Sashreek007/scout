import { createHash } from 'node:crypto';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { normalizeQuestion, questionKey } from './questions';

describe('normalizeQuestion', () => {
  it.each([
    ['Are you legally eligible to work in Canada?', 'are you legally eligible to work in canada'],
    ['  How did you   hear about us?\n', 'how did you hear about us'],
    ["What's your earliest start date (MM/YYYY)?", 'whats your earliest start date mmyyyy'],
    ['Pronouns — optional', 'pronouns optional'],
    ['Êtes-vous admissible?', 'êtesvous admissible'],
  ])('turns %j into %j', (input, expected) => {
    expect(normalizeQuestion(input)).toBe(expected);
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        expect(normalizeQuestion(normalizeQuestion(text))).toBe(normalizeQuestion(text));
      }),
    );
  });
});

describe('questionKey', () => {
  it('is the SHA-256 of the normalized question', async () => {
    const expected = createHash('sha256')
      .update('are you legally eligible to work in canada')
      .digest('hex');
    expect(await questionKey('Are you legally eligible to work in Canada?')).toBe(expected);
  });

  it('gives the same key however the question is punctuated or spaced', async () => {
    expect(await questionKey('How did you hear about us?')).toBe(
      await questionKey('how did you hear   about us'),
    );
    expect(await questionKey('How did you hear about us?')).not.toBe(
      await questionKey('How did you hear about this role?'),
    );
  });
});
