import { describe, expect, it } from 'vitest';
import { mapWithLimit } from './map-with-limit';

describe('mapWithLimit', () => {
  it('keeps the input order and never runs more than the limit at once', async () => {
    let running = 0;
    let most = 0;
    const out = await mapWithLimit([5, 1, 4, 2, 3], 2, async (n) => {
      running += 1;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, n * 5));
      running -= 1;
      return n * 10;
    });
    expect(out).toEqual([50, 10, 40, 20, 30]);
    expect(most).toBe(2);
  });

  it('handles an empty list', async () => {
    expect(await mapWithLimit([], 4, () => Promise.resolve(1))).toEqual([]);
  });
});
