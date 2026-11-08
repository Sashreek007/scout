// Triage (#9): which jobs go to Claude, what it is told, and how its answer is checked before it is
// stored (docs/architecture.md, section 5, "Triage"). The call itself is behind the `Llm` port.
import { TriageSchema, type Job, type Profile, type Triage } from './schemas';

/** On the first run, only postings this recent are triaged, so the backlog doesn't cost a fortune. */
export const TRIAGE_FIRST_RUN_DAYS = 21;
const DAY_MS = 24 * 60 * 60 * 1000;

const yesNo = (value: boolean) => (value ? 'yes' : 'no');

/**
 * What triage knows about him: studies, work permit, availability and targets. Nothing that
 * identifies or reaches him, like his name, email, phone, links or resume files, is in it.
 */
function aboutHim(profile: Profile): string {
  const { education, work_authorization: work, availability, filters } = profile;
  const relocation = Object.entries(availability.relocation).sort(([a], [b]) => (a < b ? -1 : 1));
  const willing = relocation.filter(([, ok]) => ok === true).map(([place]) => place);
  const unwilling = relocation.filter(([, ok]) => ok === false).map(([place]) => place);
  const list = (values: readonly (string | number)[], none: string) =>
    values.length > 0 ? values.join(', ') : none;
  return [
    `- Studies: ${education.degree} at ${education.school}, year ${String(education.year_of_study)}, graduating ${education.expected_graduation}.`,
    `- Work authorization: ${work.status}. Canadian citizen or permanent resident: ${yesNo(work.canadian_citizen_or_pr)}. Needs sponsorship for a co-op: ${yesNo(work.requires_sponsorship_for_coop)}. Program: ${work.internship_program}.`,
    `- Available from ${availability.earliest_start}, for terms of ${list(availability.term_lengths_ok, 'any length')} months.`,
    `- Would move to or work from: ${list(willing, 'not stated')}. Would not: ${list(unwilling, 'none stated')}.`,
    `- Target roles: ${list(filters.target_roles, 'not stated')}.`,
    `- Wanted terms: ${list(filters.terms, `any term from ${availability.earliest_start} on`)}.`,
    `- Will not work for: ${list(filters.excluded_employers, 'no one listed')}, or in ${list(filters.excluded_sectors, 'no sector listed')}.`,
  ].join('\n');
}

/**
 * The instructions and his profile: the stable start of every triage prompt, marked for caching.
 * Built only from the profile, in a fixed order, so every call in a run sends the same bytes.
 */
export function triageInstructions(profile: Profile): string {
  return `You triage internship and co-op postings for one university student in Canada. For each posting, decide whether it is worth his time, give it a score, say why in a few short lines he reads in his morning digest, and say which side of his work his resume should lead with.

How to decide:
- apply, score 70 to 100: a software, AI or machine learning, or DevOps and platform internship or co-op he can take. It is in Canada or remote from Canada, open to a student on a study permit with a co-op work permit, in a term he is available for, and close to the roles he targets.
- maybe, score 40 to 69: worth a look, with a real doubt. For example an adjacent role like data, QA, security or firmware, a term or location that isn't clear, a level that may be above an intern, or a posting too thin to judge.
- skip, score 0 to 39: not for him. For example not a student role, a field he doesn't target, a senior or full-time role, or a requirement he can't meet.
Within each band, score higher when the work is closer to what he targets and the posting is clearer.

Reasons: at most three lines, each under 120 characters. Plain and specific: the role and the city, what in the posting matches his targets, and the biggest doubt if there is one. No praise and no filler.

Lead: backend for APIs, services, distributed systems, databases and general software engineering. ai for machine learning, LLMs, data science and AI products. devops for infrastructure, cloud, site reliability, platform, CI/CD and observability. Pick the one the posting leans on most.

Flags: anything the rules before you might have missed, a few words each. For example a citizenship, permanent residence or security clearance requirement in the text, a government wage-subsidy program like SWPP or FSWEP, a location outside Canada, a term that doesn't fit, a senior or full-time role, unpaid work, or a defence, weapons or surveillance employer. Leave the list empty when there is nothing.

When the posting has no text, judge from the title, company and location only, keep the score in the maybe band unless the title alone settles it, and say in a reason that you only had the title.

Answer with the JSON object the schema describes and nothing else.

About him:
${aboutHim(profile)}`;
}

/** One posting, as the part of the prompt that changes from call to call. */
export function triageInput(job: Job): string {
  const lines = [
    'Triage this posting.',
    `Company: ${job.company}`,
    `Title: ${job.title}`,
    `Locations: ${job.locations.length > 0 ? job.locations.join('; ') : 'not given'}`,
    `Terms: ${job.terms.length > 0 ? job.terms.join(', ') : (job.rawTerm ?? 'not given')}`,
    `Posted: ${job.postedAt ? job.postedAt.toISOString().slice(0, 10) : 'not given'}`,
  ];
  if (job.filter && job.filter.flags.length > 0) {
    lines.push(`Flagged by the rules: ${job.filter.flags.join(', ')}`);
  }
  lines.push(
    job.description === null
      ? 'No posting text: judge from the title, company and location only.'
      : `Posting text:\n${job.description}`,
  );
  return lines.join('\n');
}

/**
 * The JSON schema for structured outputs. It has only what structured outputs support, so the
 * limits on score and reasons are applied by `readTriage` and checked by `TriageSchema`.
 */
export const TRIAGE_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    decision: { type: 'string', enum: ['apply', 'maybe', 'skip'] },
    score: { type: 'integer', description: 'From 0 to 100' },
    reasons: {
      type: 'array',
      items: { type: 'string' },
      description: 'At most three, each under 120 characters',
    },
    lead: { type: 'string', enum: ['backend', 'ai', 'devops'] },
    flags: { type: 'array', items: { type: 'string' } },
  },
  required: ['decision', 'score', 'reasons', 'lead', 'flags'],
  additionalProperties: false,
} as const;

const MAX_REASON = 120;
export const TITLE_ONLY_REASON = 'Title only: no posting text to read';

function clip(text: string): string {
  const trimmed = text.trim();
  return trimmed.length <= MAX_REASON ? trimmed : `${trimmed.slice(0, MAX_REASON - 1)}…`;
}

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    : [];

/**
 * Claude's answer as a stored triage: the JSON parsed, the score kept within 0 to 100, at most three
 * reasons of at most 120 characters, then checked with `TriageSchema`. A posting with no text gets
 * "Title only" as its first reason, so the digest always says so. Throws if the answer is unusable.
 */
export function readTriage(text: string, job: Pick<Job, 'description'>): Triage {
  const raw = JSON.parse(text) as Record<string, unknown>;
  const score = typeof raw.score === 'number' ? Math.round(raw.score) : raw.score;
  let reasons = strings(raw.reasons).map(clip);
  if (job.description === null) {
    reasons = [TITLE_ONLY_REASON, ...reasons.filter((r) => !/^title only/i.test(r))];
  }
  return TriageSchema.parse({
    decision: raw.decision,
    score: typeof score === 'number' ? Math.min(100, Math.max(0, score)) : score,
    reasons: reasons.slice(0, 3),
    lead: raw.lead,
    flags: strings(raw.flags).map((flag) => flag.trim()),
  });
}

/**
 * The jobs to triage this run: active, passed the filters, and not triaged yet. A job whose content
 * changed lost its triage in #7, so it is picked again. Newest first, at most `max`. On the first
 * run, only postings from the last 21 days, so the backlog of old postings is left alone.
 */
export function selectForTriage(
  jobs: readonly Job[],
  options: { now: Date; firstRun: boolean; max: number },
): Job[] {
  const since = options.now.getTime() - TRIAGE_FIRST_RUN_DAYS * DAY_MS;
  return jobs
    .filter((job) => job.active && job.filter?.passed === true && job.triage === null)
    .filter(
      (job) => !options.firstRun || (job.postedAt !== null && job.postedAt.getTime() >= since),
    )
    .sort(
      (a, b) =>
        (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0) ||
        (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
    )
    .slice(0, options.max);
}
