// Splitting many writes into Firestore batches (#7). One batched write takes at most 500 writes,
// and one request at most 10 MiB, so a run that sees hundreds of postings with long descriptions
// needs both limits.

export interface BatchLimits {
  maxWrites: number;
  maxBytes: number;
}

/** 500 writes is Firestore's limit. 8 MiB leaves room under its 10 MiB request limit. */
export const FIRESTORE_BATCH: BatchLimits = { maxWrites: 500, maxBytes: 8 * 1024 * 1024 };

const encoder = new TextEncoder();

/** About how many bytes a document takes on the wire: its JSON in UTF-8. */
export function jsonBytes(value: unknown): number {
  return encoder.encode(JSON.stringify(value)).length;
}

/**
 * Splits items into batches in order, each with at most `maxWrites` items and at most `maxBytes`
 * by `bytesOf`. An item bigger than `maxBytes` on its own gets a batch of its own.
 */
export function writeBatches<T>(
  items: readonly T[],
  bytesOf: (item: T) => number = jsonBytes,
  limits: BatchLimits = FIRESTORE_BATCH,
): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let bytes = 0;
  for (const item of items) {
    const size = bytesOf(item);
    if (
      current.length > 0 &&
      (current.length >= limits.maxWrites || bytes + size > limits.maxBytes)
    ) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(item);
    bytes += size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}
