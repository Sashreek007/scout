/** Runs `work` and turns a thrown error into a rejected promise, as a real async adapter would. */
export function settle<T>(work: () => T): Promise<T> {
  return new Promise((resolve) => {
    resolve(work());
  });
}
