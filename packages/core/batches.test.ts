import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FIRESTORE_BATCH, jsonBytes, writeBatches } from './batches';

describe('writeBatches', () => {
  it('puts at most 500 writes in a batch', () => {
    const items = Array.from({ length: 1201 }, (_, i) => i);
    expect(writeBatches(items, () => 1).map((batch) => batch.length)).toEqual([500, 500, 201]);
  });

  it('starts a new batch before one would pass the byte limit', () => {
    const limits = { maxWrites: 500, maxBytes: 100 };
    expect(writeBatches([60, 30, 20, 100, 150, 1], (n) => n, limits)).toEqual([
      [60, 30],
      [20],
      [100],
      [150],
      [1],
    ]);
  });

  it('keeps every item once, in order, within both limits', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 4_000_000 }), { maxLength: 1200 }),
        (sizes) => {
          const batches = writeBatches(sizes, (n) => n);
          expect(batches.flat()).toEqual(sizes);
          for (const batch of batches) {
            expect(batch.length).toBeLessThanOrEqual(FIRESTORE_BATCH.maxWrites);
            const total = batch.reduce((a, b) => a + b, 0);
            if (batch.length > 1) expect(total).toBeLessThanOrEqual(FIRESTORE_BATCH.maxBytes);
          }
        },
      ),
    );
  });

  it('measures a document by its JSON in UTF-8', () => {
    expect(jsonBytes({ city: 'Montréal' })).toBe('{"city":"Montréal"}'.length + 1);
  });
});
