/** Runs at most `limit` tasks at once across everyone who shares it, starting them in order. */
export interface Limiter {
  run<T>(task: () => Promise<T>): Promise<T>;
}

export function createLimiter(limit: number): Limiter {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('a limit is a whole number above 0');
  let running = 0;
  const waiting: (() => void)[] = [];

  return {
    async run(task) {
      if (running >= limit) {
        await new Promise<void>((resolve) => {
          waiting.push(resolve);
        });
      } else {
        running += 1;
      }
      try {
        return await task();
      } finally {
        // Hand the slot straight to the next task, or give it back.
        const next = waiting.shift();
        if (next) next();
        else running -= 1;
      }
    },
  };
}
