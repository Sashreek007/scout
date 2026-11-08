import { z } from 'zod';
import { JobKeySchema, TimestampSchema } from './common';
import { FilterReasonSchema, TriageDecisionSchema } from './job';

const Count = z.int().min(0);

/** What one source produced in one run (#11). */
export const SourceCountsSchema = z.strictObject({
  fetched: Count,
  valid: Count,
  invalid: Count,
  new: Count,
  changed: Count,
});
export type SourceCounts = z.infer<typeof SourceCountsSchema>;

/** What a run did to the stored jobs (#7). Runs stored before #7 load with zeros. */
export const JobCountsSchema = z.strictObject({
  new: Count,
  changed: Count,
  unchanged: Count,
  /** Postings with no location in Canada, which weren't stored. */
  outsideCanada: Count,
  /** Stored jobs this run read every source of and found in none (#10). */
  missed: Count.default(0),
  /** Jobs that reached three misses this run and became inactive. */
  inactive: Count.default(0),
  /** Applications closed because their posting became inactive. */
  applicationsClosed: Count.default(0),
});
export type JobCounts = z.infer<typeof JobCountsSchema>;

/** An error that was caught so the run could carry on. Never holds a secret (#11). */
export const RunErrorSchema = z.strictObject({
  step: z.string().min(1),
  target: z.string().min(1).nullable(),
  message: z.string().min(1),
  /**
   * The HTTP status, when one came back. A board that answered 404 is gone rather than broken, so
   * the digest doesn't call it a failure (#12). Errors stored before #11 load with null.
   */
  status: z.int().nullable().default(null),
  at: TimestampSchema,
});
export type RunError = z.infer<typeof RunErrorSchema>;

/** One job in the digest: what the notification's Today page lists (#12). Job details only. */
export const DigestLineSchema = z.strictObject({
  jobKey: JobKeySchema,
  company: z.string().min(1),
  title: z.string().min(1),
  location: z.string().min(1),
  decision: z.enum(['apply', 'maybe']),
  score: z.int().min(0).max(100),
  reason: z.string(),
});
export type DigestLine = z.infer<typeof DigestLineSchema>;

/** The digest of one run: its one-line title, the best new jobs, what is waiting, what failed. */
export const DigestSchema = z.strictObject({
  /** The notification's one short line, like "9 new matches, 4 questions waiting". */
  title: z.string().min(1),
  /** New apply and maybe jobs this run, of which at most 10 are in `lines`. */
  matches: Count,
  lines: z.array(DigestLineSchema).max(10),
  questions: Count,
  sheets: Count,
  /** Sources and steps that failed, by name. */
  failures: z.array(z.string().min(1)),
  /** True once the notification went out. */
  notified: z.boolean(),
});
export type Digest = z.infer<typeof DigestSchema>;

/** `runs/{runId}`: one pipeline or agent run, with its counts and errors. */
export const RunSchema = z
  .strictObject({
    id: z.string().min(1),
    kind: z.enum(['pipeline', 'agent']),
    status: z.enum(['running', 'ok', 'partial', 'failed']),
    /** The git commit the run was built from. */
    commit: z
      .string()
      .regex(/^[0-9a-f]{7,40}$/)
      .nullable(),
    startedAt: TimestampSchema,
    finishedAt: TimestampSchema.nullable(),
    sources: z.record(z.string().min(1), SourceCountsSchema),
    jobs: JobCountsSchema.default({
      new: 0,
      changed: 0,
      unchanged: 0,
      outsideCanada: 0,
      missed: 0,
      inactive: 0,
      applicationsClosed: 0,
    }),
    filterReasons: z.partialRecord(FilterReasonSchema, Count),
    triageDecisions: z.partialRecord(TriageDecisionSchema, Count),
    /** Claude's tokens this run. Runs stored before #9 load with no cache writes. */
    tokens: z.strictObject({
      input: Count,
      output: Count,
      cacheRead: Count,
      cacheWrite: Count.default(0),
    }),
    costUsd: z.number().min(0),
    errors: z.array(RunErrorSchema),
    /** The digest sent after a pipeline run (#12). Null for agent runs and runs before #12. */
    digest: DigestSchema.nullable().default(null),
  })
  .refine((run) => (run.status === 'running') === (run.finishedAt === null), {
    message: 'a run has finishedAt exactly when it is no longer running',
    path: ['finishedAt'],
  });
export type Run = z.infer<typeof RunSchema>;
