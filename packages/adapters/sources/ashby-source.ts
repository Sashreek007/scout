import { htmlToText } from '@scout/core';
import { z } from 'zod';
import { BoardSource, feedDate, type BoardFeed, type BoardSourceDeps } from './board-source';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const AshbyJobSchema = z.looseObject({
  id: z.string().regex(UUID),
  title: z.string().trim().min(1),
  location: z.string().nullish(),
  secondaryLocations: z.array(z.looseObject({ location: z.string().nullish() })).nullish(),
  isRemote: z.boolean().nullish(),
  isListed: z.boolean().nullish(),
  jobUrl: z.url().nullish(),
  applyUrl: z.url().nullish(),
  publishedAt: z.string().nullish(),
  descriptionPlain: z.string().nullish(),
  descriptionHtml: z.string().nullish(),
});
type AshbyJob = z.infer<typeof AshbyJobSchema>;

function locations(job: AshbyJob): string[] {
  const named = [job.location ?? '', ...(job.secondaryLocations ?? []).map((s) => s.location ?? '')]
    .map((l) => l.trim())
    .filter((l) => l !== '');
  // isRemote has no place of its own, so it becomes "Remote" unless a location already says so.
  return job.isRemote && !named.some((l) => /\bremote\b/i.test(l)) ? [...named, 'Remote'] : named;
}

const ashbyFeed: BoardFeed<AshbyJob> = {
  ats: 'ashby',
  label: 'an Ashby job board',
  rows: (body) => {
    const jobs = (body as { jobs?: unknown } | null)?.jobs;
    return Array.isArray(jobs) ? jobs : null;
  },
  row: AshbyJobSchema,
  posting: (job) =>
    job.isListed === false
      ? null
      : {
          id: job.id.toLowerCase(),
          // Ashby's feed doesn't name the company; the board's known name or its token stands in.
          company: null,
          title: job.title,
          locations: locations(job),
          url: job.applyUrl ?? job.jobUrl ?? null,
          postedAt: feedDate(job.publishedAt),
          description: job.descriptionPlain ?? htmlToText(job.descriptionHtml ?? ''),
        },
};

/**
 * A company's Ashby board, from `api.ashbyhq.com/posting-api/job-board/{token}` with compensation
 * (#6). Locations are `location` and `secondaryLocations`, plus "Remote" when `isRemote` is set.
 */
export class AshbySource extends BoardSource<AshbyJob> {
  constructor(deps: BoardSourceDeps) {
    super(ashbyFeed, deps);
  }
}
