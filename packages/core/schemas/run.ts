import { z } from 'zod';
import { TimestampSchema } from './common';
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
});
export type JobCounts = z.infer<typeof JobCountsSchema>;

/** An error that was caught so the run could carry on. Never holds a secret (#11). */
export const RunErrorSchema = z.strictObject({
  step: z.string().min(1),
  target: z.string().min(1).nullable(),
  message: z.string().min(1),
  at: TimestampSchema,
});
export type RunError = z.infer<typeof RunErrorSchema>;

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
    jobs: JobCountsSchema.default({ new: 0, changed: 0, unchanged: 0, outsideCanada: 0 }),
    filterReasons: z.partialRecord(FilterReasonSchema, Count),
    triageDecisions: z.partialRecord(TriageDecisionSchema, Count),
    tokens: z.strictObject({ input: Count, output: Count, cacheRead: Count }),
    costUsd: z.number().min(0),
    errors: z.array(RunErrorSchema),
  })
  .refine((run) => (run.status === 'running') === (run.finishedAt === null), {
    message: 'a run has finishedAt exactly when it is no longer running',
    path: ['finishedAt'],
  });
export type Run = z.infer<typeof RunSchema>;
