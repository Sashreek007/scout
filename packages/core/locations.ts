// Which locations are in Canada. Sashreek can only take Canadian roles, so this decides which
// boards are worth polling (#6), and the location filter (#8) uses the same rule.

const PROVINCE_CODE = /,\s*(?:AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\b/;

const PROVINCES = [
  'alberta',
  'british columbia',
  'manitoba',
  'new brunswick',
  'newfoundland',
  'nova scotia',
  'northwest territories',
  'nunavut',
  'ontario',
  'prince edward island',
  'quebec',
  'saskatchewan',
  'yukon',
];

/**
 * Cities that board feeds often write on their own, like Lever's "Toronto". Names shared with a
 * big place elsewhere, like London, Victoria, Hamilton, Kingston, Surrey or Richmond, are left out.
 */
const CITIES = [
  'brampton',
  'burnaby',
  'calgary',
  'edmonton',
  'fredericton',
  'gatineau',
  'guelph',
  'halifax',
  'kanata',
  'kitchener',
  'laval',
  'markham',
  'mississauga',
  'moncton',
  'montreal',
  'oakville',
  'ottawa',
  'regina',
  'richmond hill',
  'saskatoon',
  'toronto',
  'vancouver',
  'vaughan',
  'waterloo',
  'winnipeg',
];

const words = (names: string[]) => new RegExp(`\\b(?:${names.join('|')})\\b`);
const CANADA = words(['canada']);
const PROVINCE = words(PROVINCES);
const CITY = words(CITIES);

/** Lowercase, without accents, so "Montréal" and "Québec" match. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * True when a location is in Canada. It counts when it says "Canada" (so "Remote in Canada"
 * counts), has a province code after a comma like `Markham, ON`, ends in a province name like
 * `Toronto, Ontario`, or is a known Canadian city on its own, like `Toronto`. A province name or a
 * city followed by somewhere else doesn't count, so `New Brunswick, NJ` and `Vancouver, WA` fail.
 */
export function isCanadianLocation(location: string): boolean {
  const folded = fold(location);
  if (CANADA.test(folded) || PROVINCE_CODE.test(location)) return true;
  const parts = folded.split(',');
  const last = parts[parts.length - 1] ?? '';
  return PROVINCE.test(last) || (parts.length === 1 && CITY.test(last));
}

/** True when any of a posting's locations is in Canada. A posting with no location isn't. */
export function hasCanadianLocation(locations: readonly string[]): boolean {
  return locations.some(isCanadianLocation);
}
