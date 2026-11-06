import { z } from 'zod';

/**
 * A point in time. Firestore stores server timestamps; the store adapters turn them into Dates on
 * read, and seed files may use ISO 8601 strings, so both are accepted and the output is a Date.
 */
export const TimestampSchema = z.union([
  z.date(),
  z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
]);
export type Timestamp = z.infer<typeof TimestampSchema>;

/** A lowercase hex SHA-256, used for content hashes, question keys and file hashes. */
export const Sha256Schema = z.string().regex(/^[0-9a-f]{64}$/, 'expected a lowercase hex SHA-256');

/**
 * A job's document ID, like `greenhouse:tribalscale:4726999006`. The application uses the same ID,
 * so it must be a valid Firestore document ID: no `/`, not `.` or `..`, and not `__name__`-shaped.
 */
export const JobKeySchema = z
  .string()
  .min(1)
  .max(500)
  .regex(/^[^/]+$/, 'job keys never contain "/"')
  .refine((key) => key !== '.' && key !== '..', 'a job key cannot be "." or ".."')
  .refine((key) => !/^__.*__$/.test(key), 'a job key cannot look like __name__');
export type JobKey = z.infer<typeof JobKeySchema>;

/** The application systems scout knows. `other` is any careers site without a dedicated reader. */
export const AtsSchema = z.enum(['greenhouse', 'lever', 'ashby', 'workday', 'other']);
export type Ats = z.infer<typeof AtsSchema>;

/** A normalized term, like `Winter 2027`. Raw terms that can't be read stay in `rawTerm`. */
export const TermSchema = z
  .string()
  .regex(/^(Winter|Spring|Summer|Fall) \d{4}$/, 'expected a term like "Winter 2027"');
export type Term = z.infer<typeof TermSchema>;

const encoder = new TextEncoder();
/** Posting text is stored as plain text, capped at 50 KB (section 6). */
export const DESCRIPTION_MAX_BYTES = 50 * 1024;
export const DescriptionSchema = z
  .string()
  .refine(
    (text) => encoder.encode(text).length <= DESCRIPTION_MAX_BYTES,
    `a description is at most ${DESCRIPTION_MAX_BYTES} bytes`,
  );

/** An answer is one string, or several for a multi-select. */
export const AnswerValueSchema = z.union([z.string(), z.array(z.string())], {
  error: (issue) =>
    issue.input === undefined ? 'required' : 'expected text, or a list of texts for a multi-select',
});
export type AnswerValue = z.infer<typeof AnswerValueSchema>;
