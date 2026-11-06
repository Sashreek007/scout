// The first step of the daily run: read every source. One source failing never stops the others;
// its error is kept so the run log (#11) can mark it failed and the digest can name it.
import type { Job, JobSource, SourceBatch } from '@scout/core';

export type SourceOutcome =
  { source: string; ok: true; batch: SourceBatch } | { source: string; ok: false; error: string };

export async function collect(sources: readonly JobSource[]): Promise<SourceOutcome[]> {
  const settled = await Promise.allSettled(sources.map((source) => source.fetch()));
  return settled.map((result, i): SourceOutcome => {
    const source = sources[i]?.id ?? `source ${String(i)}`;
    return result.status === 'fulfilled'
      ? { source, ok: true, batch: result.value }
      : { source, ok: false, error: (result.reason as Error).message };
  });
}

/**
 * Short links that were already followed, from the stored jobs: each source link that differs from
 * the job's resolved apply URL. Passed to the list sources so each short link is followed only
 * once. It relies on the job keeping each listing's `sourceUrl` in `sources[].url` (#7).
 */
export function knownShortLinks(jobs: readonly Job[]): Map<string, string> {
  const known = new Map<string, string>();
  for (const job of jobs) {
    if (job.unresolvedUrl) continue;
    for (const ref of job.sources) {
      if (ref.url && ref.url !== job.applyUrl) known.set(ref.url, job.applyUrl);
    }
  }
  return known;
}
