// What a Claude call costs, to estimate each run's spend (#9). From Anthropic's pricing on
// 2026-11-07, per million tokens. An estimate for the run log, not a bill.

export interface TokenUsage {
  /** Input tokens that weren't read from or written to the cache. */
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export const NO_USAGE: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

/** Input and output dollars per million tokens, at prompts up to 100K tokens. */
const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
};

/** The dearest model's price, for a model the table doesn't know, so a cost is never understated. */
const UNKNOWN = { input: 4, output: 20, cacheRead: 0.2 };

/** A 5-minute cache write costs 1.25 times the input price. */
const CACHE_WRITE = 1.25;

/** The estimated cost in dollars. The Batches API is half price on every kind of token. */
export function costUsd(model: string, usage: TokenUsage, options: { batch: boolean }): number {
  const price = PRICES[model] ?? UNKNOWN;
  const dollars =
    usage.input * price.input +
    usage.output * price.output +
    usage.cacheRead * price.cacheRead +
    usage.cacheWrite * price.input * CACHE_WRITE;
  return (dollars / 1_000_000) * (options.batch ? 0.5 : 1);
}

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite: a.cacheWrite + b.cacheWrite,
  };
}
