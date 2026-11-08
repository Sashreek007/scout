import { z } from 'zod';
import {
  AtsSchema,
  DescriptionSchema,
  JobKeySchema,
  Sha256Schema,
  TermSchema,
  TimestampSchema,
} from './common';

/** Where a job was found. `you` carries the link he pasted. */
export const JobSourceRefSchema = z.strictObject({
  name: z.string().min(1),
  url: z.url().nullable(),
});
export type JobSourceRef = z.infer<typeof JobSourceRefSchema>;

/** The hard filters, in the order they run (#8). Each failed rule is saved as a reason. */
export const FILTER_REASONS = [
  'location',
  'role',
  'term',
  'values',
  'eligibility',
  'already_applied',
] as const;
export const FilterReasonSchema = z.enum(FILTER_REASONS);
export type FilterReason = z.infer<typeof FilterReasonSchema>;

/**
 * Flags don't drop a job; they mark it for a closer look. `eligibility_review` marks a citizen or
 * PR clause that also lets a work permit in, which his co-op permit may meet.
 */
export const FILTER_FLAGS = [
  'term_unknown',
  'values_review',
  'clearance',
  'eligibility_review',
] as const;
export const FilterFlagSchema = z.enum(FILTER_FLAGS);
export type FilterFlag = z.infer<typeof FilterFlagSchema>;

export const FilterCodeSchema = z.enum([...FILTER_REASONS, ...FILTER_FLAGS]);
export type FilterCode = z.infer<typeof FilterCodeSchema>;

export const FilterResultSchema = z
  .strictObject({
    passed: z.boolean(),
    reasons: z.array(FilterReasonSchema),
    flags: z.array(FilterFlagSchema),
    /**
     * What each reason or flag found, like `General Dynamics is on the excluded employers`, so the
     * dashboard can show why (#44). Results stored before #8 load with none.
     */
    details: z.partialRecord(FilterCodeSchema, z.string().min(1)).default({}),
  })
  .refine((result) => result.passed === (result.reasons.length === 0), {
    message: 'a job passes exactly when no filter gave a reason',
    path: ['passed'],
  });
export type FilterResult = z.infer<typeof FilterResultSchema>;

export const TriageDecisionSchema = z.enum(['apply', 'maybe', 'skip']);
export type TriageDecision = z.infer<typeof TriageDecisionSchema>;

/** Claude's triage of one posting, checked before it is stored (section 5, "Triage"). */
export const TriageSchema = z.strictObject({
  decision: TriageDecisionSchema,
  score: z.int().min(0).max(100),
  reasons: z.array(z.string().min(1).max(120)).max(3),
  /** Which side of his work leads the resume. Tailoring starts from it. */
  lead: z.enum(['backend', 'ai', 'devops']),
  /** Anything the code filters might have missed, like a citizenship clause in the body. */
  flags: z.array(z.string().min(1)),
});
export type Triage = z.infer<typeof TriageSchema>;

/** `jobs/{jobKey}`: one posting, however many sources list it. */
export const JobSchema = z.strictObject({
  key: JobKeySchema,
  ats: AtsSchema,
  /** The board token on Greenhouse, Lever or Ashby, like `tribalscale`. */
  boardToken: z.string().min(1).nullable(),
  postingId: z.string().min(1).nullable(),
  company: z.string().min(1),
  title: z.string().min(1),
  locations: z.array(z.string().min(1)),
  rawTerm: z.string().nullable(),
  terms: z.array(TermSchema),
  applyUrl: z.url(),
  unresolvedUrl: z.boolean(),
  postedAt: TimestampSchema.nullable(),
  description: DescriptionSchema.nullable(),
  sources: z.array(JobSourceRefSchema).min(1),
  /** SHA-256 of the normalized title, sorted locations, terms and description (#7). */
  contentHash: Sha256Schema,
  filter: FilterResultSchema.nullable(),
  triage: TriageSchema.nullable(),
  /** False after three runs that didn't list it (#10). */
  active: z.boolean(),
  missedRuns: z.int().min(0),
  firstSeenAt: TimestampSchema,
  lastSeenAt: TimestampSchema,
});
export type Job = z.infer<typeof JobSchema>;
