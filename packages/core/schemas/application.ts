import { z } from 'zod';
import { JobKeySchema, TimestampSchema } from './common';
import { FormSpecSchema } from './form';
import { SheetSchema } from './sheet';
import { StageSchema } from './stage';

/** The agent's claim on an application. Only the agent writes it (section 6, security rules). */
export const LeaseSchema = z.strictObject({
  /** This machine and process, like `sashreeks-mac:4821`. */
  owner: z.string().min(1),
  expiresAt: TimestampSchema,
});
export type Lease = z.infer<typeof LeaseSchema>;

/**
 * `applications/{jobKey}`: one application per posting, with the same ID as its job. The stage
 * only changes through the stage machine, together with its event.
 */
export const ApplicationSchema = z.strictObject({
  jobKey: JobKeySchema,
  /** Copied from the job so the Board and Today pages don't read every job. */
  company: z.string().min(1),
  title: z.string().min(1),
  stage: StageSchema,
  stageAt: TimestampSchema,
  form: FormSpecSchema.nullable(),
  sheet: SheetSchema.nullable(),
  lease: LeaseSchema.nullable(),
  /** Written before the agent clicks Submit, so a crash can never lead to a second submission. */
  submitAttemptAt: TimestampSchema.nullable(),
  submittedAt: TimestampSchema.nullable(),
  /** The first 500 characters of the board's confirmation page. */
  confirmationText: z.string().max(500).nullable(),
  notes: z.string(),
  /** The session summary written after each turn (section 5d). */
  summary: z.string().nullable(),
  createdAt: TimestampSchema,
});
export type Application = z.infer<typeof ApplicationSchema>;
