import { describe, expect, it } from 'vitest';
import { addUsage, costUsd } from './prices';

const million = { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 };

describe('costUsd', () => {
  it('prices Haiku 5.5 and Sonnet 5.5 per million tokens', () => {
    expect(costUsd('claude-haiku-5-5', million, { batch: false })).toBeCloseTo(0.1);
    expect(
      costUsd('claude-sonnet-5-5', { ...million, input: 0, output: 1e6 }, { batch: false }),
    ).toBeCloseTo(10);
  });

  it('halves everything on the Batches API', () => {
    const usage = { input: 1500, output: 1000, cacheRead: 3000, cacheWrite: 0 };
    expect(costUsd('claude-haiku-5-5', usage, { batch: true })).toBeCloseTo(
      costUsd('claude-haiku-5-5', usage, { batch: false }) / 2,
    );
  });

  it('charges cache reads at a tenth of input on Haiku and writes at 1.25 times', () => {
    expect(
      costUsd('claude-haiku-5-5', { ...million, input: 0, cacheRead: 1e6 }, { batch: false }),
    ).toBeCloseTo(0.01);
    expect(
      costUsd('claude-haiku-5-5', { ...million, input: 0, cacheWrite: 1e6 }, { batch: false }),
    ).toBeCloseTo(0.125);
  });

  it('prices a model it does not know as the dearest one, never as free', () => {
    expect(costUsd('claude-unknown', million, { batch: false })).toBeCloseTo(4);
  });

  it('matches the architecture estimate: a month of triage is under $1', () => {
    // 30 postings a day: 1,500 new input, 3,000 cached and 1,000 output tokens each, batched.
    const day = { input: 30 * 1500, output: 30 * 1000, cacheRead: 30 * 3000, cacheWrite: 0 };
    expect(costUsd('claude-haiku-5-5', day, { batch: true }) * 30).toBeLessThan(1);
  });
});

describe('addUsage', () => {
  it('adds each kind of token', () => {
    expect(
      addUsage(
        { input: 1, output: 2, cacheRead: 3, cacheWrite: 4 },
        { input: 1, output: 1, cacheRead: 1, cacheWrite: 1 },
      ),
    ).toEqual({ input: 2, output: 3, cacheRead: 4, cacheWrite: 5 });
  });
});
