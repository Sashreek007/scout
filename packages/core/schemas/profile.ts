import { z } from 'zod';
import { Sha256Schema, TermSchema } from './common';

/**
 * `profile/main`: every fact about him that a form can ask for. Keys mirror `profile/profile.yaml`,
 * which seeds it (#4), so they are snake_case like the file.
 *
 * `TODO` marks a value he still has to fill or confirm. A required field set to `TODO` fails with
 * "TODO is not allowed". An optional one may stay `TODO`; the planner treats it as unknown.
 */
export const TODO = 'TODO';

export function isTodo(value: unknown): boolean {
  return typeof value === 'string' && value.trim().toUpperCase() === TODO;
}

/** A field that must be filled: `TODO` is rejected before the inner schema runs. */
function required<T extends z.ZodType>(schema: T) {
  return z
    .unknown()
    .superRefine((value, ctx) => {
      if (isTodo(value)) ctx.addIssue({ code: 'custom', message: 'TODO is not allowed' });
    })
    .pipe(schema);
}

/** A field he may leave empty (null) or still `TODO`. */
function optional<T extends z.ZodType>(schema: T) {
  return z
    .preprocess(
      (value) => (isTodo(value) ? TODO : value),
      z.union([z.literal(TODO), schema]).nullable(),
    )
    .default(null);
}

const Text = z.string().trim().min(1);

/**
 * The role filter's defaults (#8): words that mark the software, AI and DevOps roles he targets.
 * Generous on purpose, because a dropped posting never reaches triage and he never sees it.
 */
export const DEFAULT_ROLE_KEYWORDS = [
  'software',
  'developer',
  'development',
  'programmer',
  'programming',
  'engineer',
  'engineering',
  'ai',
  'genai',
  'artificial intelligence',
  'ml',
  'machine learning',
  'deep learning',
  'llm',
  'data',
  'devops',
  'sre',
  'site reliability',
  'reliability',
  'cloud',
  'platform',
  'infrastructure',
  'backend',
  'back end',
  'frontend',
  'front end',
  'full stack',
  'fullstack',
  'web',
  'mobile',
  'ios',
  'android',
  'firmware',
  'embedded',
  'linux',
  'qa',
  'quality assurance',
  'security',
  'cybersecurity',
  'automation',
  'computer science',
  'computing',
  'science',
  'it',
  'technology',
  'technical',
  'research',
  'researcher',
  'scientist',
  'quant',
  'quantitative',
  'analytics',
  'systems',
  'libraries',
] as const;

/** Titles that fail the role filter by default: hardware, analog, mechanical, sales, marketing. */
export const DEFAULT_EXCLUDED_ROLE_KEYWORDS = [
  'hardware',
  'analog',
  'mixed signal',
  'mechanical',
  'sales',
  'marketing',
] as const;

const MONTHS =
  'January|February|March|April|May|June|July|August|September|October|November|December';
/** A month and year, like `January 2027`, so the planner can turn it into any date format. */
const MonthYear = z
  .string()
  .trim()
  .regex(new RegExp(`^(${MONTHS}) \\d{4}$`), 'expected a month and year, like "January 2027"');

/** YAML 1.2 reads `yes` and `no` as strings, so both spellings are accepted. */
const YesNo = z
  .union([z.boolean(), z.enum(['yes', 'no'])])
  .transform((value) => value === true || value === 'yes');

/** A resume file on the Mac, with the hash the agent checks before uploading it. */
export const ResumeFileSchema = z.strictObject({
  path: Text,
  sha256: Sha256Schema,
});
export type ResumeFile = z.infer<typeof ResumeFileSchema>;

export const ProfileSchema = z.strictObject({
  identity: z.strictObject({
    full_name: required(Text),
    email: required(z.email()),
    phone: required(z.string().trim().min(7)),
    city: required(Text),
    pronouns: optional(Text),
  }),
  links: z.strictObject({
    linkedin: optional(z.url()),
    github: required(z.url()),
    portfolio: optional(z.url()),
  }),
  education: z.strictObject({
    school: required(Text),
    degree: required(Text),
    year_of_study: required(z.int().min(1).max(8)),
    expected_graduation: required(MonthYear),
    gpa: optional(z.union([z.number().positive(), Text])),
  }),
  work_authorization: z.strictObject({
    status: required(Text),
    citizenship: required(Text),
    requires_sponsorship_for_coop: required(z.boolean()),
    canadian_citizen_or_pr: required(z.boolean()),
    internship_program: required(Text),
    sip_registered: required(z.boolean()),
    us_work_authorized: required(z.boolean()),
  }),
  availability: z.strictObject({
    earliest_start: required(MonthYear),
    /** Term lengths in months he will take, like 4, 8 or 12. */
    term_lengths_ok: required(z.array(z.int().positive()).min(1)),
    /** City (or `remote`) to whether he would move there. */
    relocation: z.record(z.string().min(1), optional(YesNo)),
  }),
  compensation: z.strictObject({
    expected_hourly_cad: optional(z.number().positive()),
  }),
  current_role: z
    .strictObject({
      company: required(Text),
      title: required(Text),
      start: required(Text),
    })
    .nullable(),
  resumes: z.strictObject({
    default: required(ResumeFileSchema),
    backend: optional(ResumeFileSchema),
    ai: optional(ResumeFileSchema),
    devops: optional(ResumeFileSchema),
  }),
  demographics: z.strictObject({
    /** Voluntary EEO questions: decline them, or answer from `answers`. */
    policy: z.enum(['decline_to_answer', 'fill']),
    answers: z.record(z.string().min(1), Text).default({}),
  }),
  filters: z.strictObject({
    excluded_sectors: z.array(Text),
    excluded_employers: z.array(Text),
    skip_if_requires: z.array(Text),
    location: z.literal('canada_only'),
    target_roles: z.array(Text).min(1),
    daily_cap: z.int().positive().nullable(),
    /** A title must name one of these to pass the role filter (#8). Matched as whole words. */
    role_keywords: z
      .array(Text)
      .min(1)
      .default([...DEFAULT_ROLE_KEYWORDS]),
    /** A title that names any of these fails the role filter, even if it names a target. */
    excluded_role_keywords: z.array(Text).default([...DEFAULT_EXCLUDED_ROLE_KEYWORDS]),
    /**
     * The terms he wants, like `Winter 2027`. Left empty, every term that starts on or after
     * `availability.earliest_start` passes the term filter.
     */
    terms: z.array(TermSchema).default([]),
  }),
});
export type Profile = z.infer<typeof ProfileSchema>;

/**
 * `profile/profile.yaml` as he writes it: the stored profile, except that each resume is a path.
 * `pnpm scout profile push` checks each file exists and stores its path with its SHA-256 (#4).
 */
export const ProfileFileSchema = ProfileSchema.extend({
  resumes: z.strictObject({
    default: required(Text),
    backend: optional(Text),
    ai: optional(Text),
    devops: optional(Text),
  }),
});
export type ProfileFile = z.infer<typeof ProfileFileSchema>;
