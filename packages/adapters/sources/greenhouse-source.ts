import { decodeEntities, htmlToText } from '@scout/core';
import { z } from 'zod';
import {
  BoardSource,
  feedDate,
  jobsArray,
  type BoardFeed,
  type BoardSourceDeps,
} from './board-source';

const GreenhouseJobSchema = z.looseObject({
  id: z.union([z.int().positive(), z.string().regex(/^\d+$/)]).transform(String),
  title: z.string().trim().min(1),
  company_name: z.string().trim().min(1).nullish(),
  location: z.looseObject({ name: z.string().nullish() }).nullish(),
  /** Not checked as a URL: scout builds its own apply URL, so a bad one costs nothing. */
  absolute_url: z.string().nullish(),
  first_published: z.string().nullish(),
  updated_at: z.string().nullish(),
  /** The posting's HTML, itself escaped: `&lt;p&gt;` for `<p>`. */
  content: z.string().nullish(),
});
type GreenhouseJob = z.infer<typeof GreenhouseJobSchema>;

const greenhouseFeed: BoardFeed<GreenhouseJob> = {
  ats: 'greenhouse',
  label: 'a Greenhouse board',
  rows: jobsArray,
  row: GreenhouseJobSchema,
  posting: (job) => ({
    id: job.id,
    company: job.company_name ?? null,
    title: job.title,
    locations: job.location?.name ? [job.location.name] : [],
    url: job.absolute_url ?? null,
    postedAt: feedDate(job.first_published) ?? feedDate(job.updated_at),
    description: job.content ? htmlToText(decodeEntities(job.content)) : null,
  }),
};

/**
 * A company's Greenhouse board, from `boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true`
 * (#6). The location is `location.name`.
 */
export class GreenhouseSource extends BoardSource<GreenhouseJob> {
  constructor(deps: BoardSourceDeps) {
    super(greenhouseFeed, deps);
  }
}
