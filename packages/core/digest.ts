// The daily digest (#12): one short notification after each run, and the full list it opens on
// the dashboard's Today page. It carries job details only: no profile data and no answers.
import type { Notice } from './ports';
import type { Digest, DigestLine, Job, RunError } from './schemas';

/** At most this many jobs are listed. */
export const DIGEST_MAX_LINES = 10;

const plural = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

/**
 * The sources and steps that failed in a run, for the digest to name. A board that answered 404
 * is gone rather than broken, so it isn't named. More than three failed boards are counted.
 */
export function failuresIn(errors: readonly RunError[]): string[] {
  const named: string[] = [];
  const boards: string[] = [];
  for (const error of errors) {
    if (error.status === 404) continue;
    let name: string;
    if (error.step === 'collect' && error.target !== null) {
      if (error.target.includes(':')) {
        boards.push(error.target);
        continue;
      }
      name = error.target;
    } else {
      name = error.step === 'run' ? 'the run' : error.step;
    }
    if (!named.includes(name)) named.push(name);
  }
  const uniqueBoards = [...new Set(boards)];
  if (uniqueBoards.length > 3) named.push(plural(uniqueBoards.length, 'board', 'boards'));
  else named.push(...uniqueBoards);
  return named;
}

export interface DigestInput {
  /** The jobs this run triaged. */
  triaged: readonly Job[];
  errors: readonly RunError[];
  waiting: { questions: number; sheets: number };
}

/**
 * The digest of one run: the new `apply` and `maybe` jobs, best score first, at most 10, each with
 * company, title, location, score and first reason; what is waiting for him; and what failed. Its
 * title is the one short line the notification shows, like "9 new matches, 4 questions waiting".
 * A run with nothing new still has a title, so a missing notification means the run didn't happen.
 */
export function buildDigest(input: DigestInput): Digest {
  const matches = input.triaged
    .filter((job) => job.triage && job.triage.decision !== 'skip')
    .sort(
      (a, b) =>
        (b.triage?.score ?? 0) - (a.triage?.score ?? 0) ||
        (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
    );
  const lines = matches.slice(0, DIGEST_MAX_LINES).map((job): DigestLine => ({
    jobKey: job.key,
    company: job.company,
    title: job.title,
    location: job.locations[0] ?? 'Location not given',
    decision: job.triage?.decision === 'apply' ? 'apply' : 'maybe',
    score: job.triage?.score ?? 0,
    reason: job.triage?.reasons[0] ?? '',
  }));
  const failures = failuresIn(input.errors);
  const { questions, sheets } = input.waiting;
  const parts = [
    matches.length > 0 ? plural(matches.length, 'new match', 'new matches') : 'No new matches',
    ...(questions > 0 ? [plural(questions, 'question waiting', 'questions waiting')] : []),
    ...(sheets > 0 ? [plural(sheets, 'sheet to review', 'sheets to review')] : []),
    ...(failures.length > 0 ? [`${failures.join(', ')} failed`] : []),
  ];
  return {
    title: parts.join(', '),
    matches: matches.length,
    lines,
    questions,
    sheets,
    failures,
    notified: false,
  };
}

/** The notification for a digest: its one short line, opening Today, where the full digest is. */
export function digestNotice(digest: Digest, dashboardUrl: string | null): Notice {
  return {
    kind: 'digest',
    title: digest.title,
    body: null,
    url: `${dashboardUrl?.replace(/\/+$/, '') ?? ''}/today`,
  };
}
