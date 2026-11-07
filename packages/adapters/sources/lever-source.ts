import { htmlToText } from '@scout/core';
import { z } from 'zod';
import { BoardSource, feedDate, type BoardFeed, type BoardSourceDeps } from './board-source';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LeverPostingSchema = z.looseObject({
  id: z.string().regex(UUID),
  /** The title. */
  text: z.string().trim().min(1),
  categories: z
    .looseObject({
      location: z.string().nullish(),
      allLocations: z.array(z.string()).nullish(),
    })
    .nullish(),
  hostedUrl: z.url().nullish(),
  applyUrl: z.url().nullish(),
  /** Milliseconds since 1970. */
  createdAt: z.number().nullish(),
  descriptionPlain: z.string().nullish(),
  /** The posting's sections, like "Requirements", each with an HTML list. */
  lists: z.array(z.looseObject({ text: z.string().nullish(), content: z.string().nullish() })).nullish(),
  additionalPlain: z.string().nullish(),
});
type LeverPosting = z.infer<typeof LeverPostingSchema>;

function description(posting: LeverPosting): string {
  const lists = (posting.lists ?? []).map((list) =>
    [list.text?.trim() ?? '', htmlToText(list.content ?? '')].filter((p) => p !== '').join('\n'),
  );
  return [posting.descriptionPlain?.trim() ?? '', ...lists, posting.additionalPlain?.trim() ?? '']
    .filter((part) => part !== '')
    .join('\n\n');
}

const leverFeed: BoardFeed<LeverPosting> = {
  ats: 'lever',
  label: 'a Lever board',
  rows: (body) => (Array.isArray(body) ? (body as unknown[]) : null),
  row: LeverPostingSchema,
  posting: (posting) => ({
    id: posting.id.toLowerCase(),
    // Lever's feed doesn't name the company; the board's known name or its token stands in.
    company: null,
    title: posting.text,
    locations: [
      posting.categories?.location ?? '',
      ...(posting.categories?.allLocations ?? []),
    ],
    url: posting.applyUrl ?? posting.hostedUrl ?? null,
    postedAt: feedDate(posting.createdAt),
    description: description(posting),
  }),
};

/**
 * A company's Lever board, from `api.lever.co/v0/postings/{token}?mode=json` (#6). Locations are
 * `categories.location` and `categories.allLocations`. Lever tokens are case-sensitive.
 */
export class LeverSource extends BoardSource<LeverPosting> {
  constructor(deps: BoardSourceDeps) {
    super(leverFeed, deps);
  }
}
