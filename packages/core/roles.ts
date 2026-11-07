// Which job-board titles look like a student role (#6). Boards list every opening a company has,
// so only these become listings; the rest never reach Firestore.
import type { Term } from './schemas';

const STUDENT_WORDS = /\b(?:interns?|internships?|co-?ops?|students?)\b/i;
const SEASON_YEAR =
  /\b(winter|spring|summer|fall)[\s,/–-]*(20\d{2})\b|\b(20\d{2})[\s,/–-]*(winter|spring|summer|fall)\b/gi;

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * The terms a title names, like "Winter 2027" in "Intern - Credit Risk, Winter 2027" or in
 * "(Winter, 2027)". `rawTerm` is what the title says, and `terms` the normalized terms.
 */
export function termsInTitle(title: string): { rawTerm: string | null; terms: Term[] } {
  const raw: string[] = [];
  const terms: Term[] = [];
  for (const match of title.matchAll(SEASON_YEAR)) {
    const season = match[1] ?? match[4] ?? '';
    const year = match[2] ?? match[3] ?? '';
    raw.push(match[0].trim());
    const term = `${capitalize(season)} ${year}`;
    if (!terms.includes(term)) terms.push(term);
  }
  return { rawTerm: raw.length > 0 ? raw.join(', ') : null, terms };
}

/**
 * True when a title reads like a student role: it says intern, internship, co-op, coop or student,
 * or names a season with a year, like "Summer 2027". "Internal" and "International" don't count.
 */
export function isStudentRole(title: string): boolean {
  return STUDENT_WORDS.test(title) || termsInTitle(title).terms.length > 0;
}
