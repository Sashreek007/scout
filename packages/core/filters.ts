// The hard filters (#8): plain rules that drop the postings Sashreek can't or won't take, before
// Claude sees any of them. They carry his work-permit limits and his values line
// (docs/architecture.md, section 4), so each failed rule is saved with a reason he can read.
import { normalizeName } from './keys';
import { hasCanadianLocation } from './locations';
import type { FilterCode, FilterFlag, FilterReason, FilterResult, Job, Profile } from './schemas';
import type { Stage } from './stages';

export interface FilterInput {
  job: Pick<Job, 'company' | 'title' | 'locations' | 'terms' | 'description'>;
  profile: Profile;
  /** The stage of the job's application, or null when there is none. */
  applicationStage: Stage | null;
}

/** Stages past `review`: he approved it, and it went in or is going in. */
const APPLIED_STAGES: readonly Stage[] = [
  'approved',
  'filling',
  'needs_hand',
  'applied',
  'assessment',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
];

/** Whole words, after normalizing, so "Back-End" matches "back end" and "AI/ML" matches "ml". */
function hasWords(text: string, phrase: string): boolean {
  const words = normalizeName(phrase);
  return words !== '' && ` ${normalizeName(text)} `.includes(` ${words} `);
}

/** When each season's term starts, as a month. Spring is the May term, as in Alberta. */
const SEASON_MONTH: Record<string, string> = {
  Winter: '01',
  Spring: '05',
  Summer: '05',
  Fall: '09',
};

/** The month a term starts in, like `2027-01` for `Winter 2027`. */
export function termStart(term: string): string {
  const [season = '', year = ''] = term.split(' ');
  return `${year}-${SEASON_MONTH[season] ?? '01'}`;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** `January 2027` as `2027-01`. */
function monthOf(monthYear: string): string {
  const [month = '', year = ''] = monthYear.split(' ');
  return `${year}-${String(MONTHS.indexOf(month) + 1).padStart(2, '0')}`;
}

/**
 * True when he wants a term: it is in `filters.terms`, or, when that list is empty, it starts on
 * or after `availability.earliest_start`.
 */
export function wantsTerm(profile: Profile, term: string): boolean {
  const listed = profile.filters.terms;
  if (listed.length > 0) return listed.includes(term);
  return termStart(term) >= monthOf(profile.availability.earliest_start);
}

/** Phrases for each `filters.skip_if_requires` entry. Any other entry is matched as written. */
const REQUIREMENT_PHRASES: Record<string, { phrases: string[]; citizenOrPr: boolean }> = {
  canadian_citizenship: { phrases: ['Canadian citizen'], citizenOrPr: true },
  permanent_residence: { phrases: ['permanent resident', 'protected person'], citizenOrPr: true },
  SWPP: { phrases: ['SWPP', 'Student Work Placement'], citizenOrPr: false },
  FSWEP: { phrases: ['FSWEP', 'Federal Student Work Experience'], citizenOrPr: false },
};

/** A phrase at the start of a word, so "Canadian citizen" also finds "Canadian citizenship". */
function phraseAt(text: string, phrase: string): number {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return text.search(new RegExp(`\\b${escaped}`, 'i'));
}

/** The sentence around a position, so "citizen, PR or work permit" is read as one clause. */
function sentenceAt(text: string, at: number): string {
  const start = Math.max(text.lastIndexOf('.', at), text.lastIndexOf('\n', at)) + 1;
  const ends = ['.', '\n'].map((mark) => text.indexOf(mark, at)).filter((end) => end !== -1);
  return text.slice(start, ends.length > 0 ? Math.min(...ends) : text.length);
}

const OPEN_TO_PERMITS = /\b(?:work permit|study permit|visa|international students?)\b/i;
const CLEARANCE = /\b(?:security clearance|controlled goods)\b/i;
/** Defence, weapons and military words, which only flag a job: dual-use employers are his call. */
const VALUES_WORDS = [
  'defence',
  'defense',
  'weapon',
  'weapons',
  'military',
  'munitions',
  'missile',
  'missiles',
];

/**
 * Runs the hard filters in their order: location, role, term, values, eligibility and already
 * applied. Every rule runs, so a job dropped for two reasons shows both. Flags don't drop a job.
 * `details` says what each reason or flag found. The function is pure: the job, his profile and
 * the application's stage are all it reads.
 */
export function filterJob({ job, profile, applicationStage }: FilterInput): FilterResult {
  const reasons: FilterReason[] = [];
  const flags: FilterFlag[] = [];
  const details: Partial<Record<FilterCode, string>> = {};
  const fail = (reason: FilterReason, detail: string) => {
    reasons.push(reason);
    details[reason] = detail;
  };
  const flag = (code: FilterFlag, detail: string) => {
    if (flags.includes(code)) return;
    flags.push(code);
    details[code] = detail;
  };
  const { filters } = profile;
  const text = [job.title, job.description ?? ''].join('\n');

  // Location: any of its locations in Canada, by the rule that picks the boards (#6).
  if (!hasCanadianLocation(job.locations)) {
    fail(
      'location',
      job.locations.length === 0
        ? 'no location given'
        : `not in Canada: ${job.locations.join('; ')}`,
    );
  }

  // Role: the title names a target keyword and no excluded one.
  const excluded = filters.excluded_role_keywords.find((word) => hasWords(job.title, word));
  if (excluded !== undefined) fail('role', `title says "${excluded}"`);
  else if (!filters.role_keywords.some((word) => hasWords(job.title, word))) {
    fail('role', 'title names none of the target roles');
  }

  // Term: one of its terms is wanted. With no known term it passes, flagged.
  if (job.terms.length === 0) flag('term_unknown', 'no term given');
  else if (!job.terms.some((term) => wantsTerm(profile, term))) {
    fail('term', `${job.terms.join(', ')} not wanted`);
  }

  // Values: an excluded employer fails, defence words only flag.
  const employer = filters.excluded_employers.find((name) => hasWords(job.company, name));
  if (employer !== undefined) fail('values', `${employer} is on the excluded employers`);
  const sectorWords = [...VALUES_WORDS, ...filters.excluded_sectors];
  const word = sectorWords.find((w) => hasWords(`${job.company}\n${text}`, w));
  if (word !== undefined) flag('values_review', `mentions "${word}"`);

  // Eligibility: requirements he can't meet fail, unless the same clause lets a work permit in.
  let blocked: string | null = null;
  for (const entry of filters.skip_if_requires) {
    const known = REQUIREMENT_PHRASES[entry];
    if (known?.citizenOrPr && profile.work_authorization.canadian_citizen_or_pr) continue;
    for (const phrase of known?.phrases ?? [entry]) {
      const at = phraseAt(text, phrase);
      if (at === -1) continue;
      if (known?.citizenOrPr && OPEN_TO_PERMITS.test(sentenceAt(text, at))) {
        flag('eligibility_review', `says "${phrase}", next to a work permit or visa`);
      } else {
        blocked ??= phrase;
      }
    }
  }
  if (blocked !== null) fail('eligibility', `says "${blocked}"`);
  const clearance = CLEARANCE.exec(text);
  if (clearance) flag('clearance', `says "${clearance[0]}"`);

  // Already applied: an application past review.
  if (applicationStage !== null && APPLIED_STAGES.includes(applicationStage)) {
    fail('already_applied', `application is ${applicationStage}`);
  }

  return { passed: reasons.length === 0, reasons, flags, details };
}
