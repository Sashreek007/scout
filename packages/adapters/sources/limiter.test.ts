import { describe, expect, it } from 'vitest';
import { createLimiter } from './limiter';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('createLimiter', () => {
  it('runs at most the limit at once, across callers, and starts the rest in order', async () => {
    const limiter = createLimiter(2);
    const gates = Array.from({ length: 5 }, deferred);
    const started: number[] = [];
    let running = 0;
    let peak = 0;
    const done = gates.map((gate, i) =>
      limiter.run(async () => {
        started.push(i);
        running += 1;
        peak = Math.max(peak, running);
        await gate.promise;
        running -= 1;
        return i;
      }),
    );
    await Promise.resolve();
    expect(started).toEqual([0, 1]);
    for (const gate of gates) gate.resolve();
    expect(await Promise.all(done)).toEqual([0, 1, 2, 3, 4]);
    expect(started).toEqual([0, 1, 2, 3, 4]);
    expect(peak).toBe(2);
  });

  it('frees the slot when a task fails', async () => {
    const limiter = createLimiter(1);
    await expect(limiter.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(await limiter.run(() => Promise.resolve('next'))).toBe('next');
  });

  it('refuses a limit that is not a whole number above 0', () => {
    expect(() => createLimiter(0)).toThrow(/above 0/);
    expect(() => createLimiter(1.5)).toThrow(/above 0/);
  });
});
