import { z } from 'zod';
import { DescriptionSchema, TermSchema, TimestampSchema } from './common';

/**
 * What a `JobSource` returns: one posting as one source saw it, before normalizing and deduping
 * turn listings into jobs (docs/architecture.md, section 5, "Normalize, dedupe and filter").
 */
export const ListingSchema = z.strictObject({
  /** The source's name, like `simplify`, `vansh`, `greenhouse` or `you` for a link he pasted. */
  source: z.string().min(1),
  company: z.string().min(1),
  title: z.string().min(1),
  locations: z.array(z.string().min(1)),
  /** The term exactly as the source wrote it, like vansh's `season`. */
  rawTerm: z.string().nullable(),
  /** Terms scout is sure of. Empty when the year or season is unknown. */
  terms: z.array(TermSchema),
  applyUrl: z.url(),
  /** True when a short link couldn't be followed to the real apply URL. */
  unresolvedUrl: z.boolean(),
  postedAt: TimestampSchema.nullable(),
  /** Board feeds carry the posting text; the GitHub lists don't. */
  description: DescriptionSchema.nullable(),
});
export type Listing = z.infer<typeof ListingSchema>;
