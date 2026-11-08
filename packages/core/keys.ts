// Job keys and content hashes (#7). A job's document ID comes from the posting, so collecting twice
// updates the same document, and the application uses the same ID, so there is at most one per
// posting (docs/architecture.md, section 4). Hashing uses Web Crypto, so the dashboard computes the
// same key as the pipeline when he pastes a link (#60).
import { parseBoardUrl } from './boards';
import type { Ats, JobKey, Listing } from './schemas';

/**
 * A company or title reduced to what it says: lowercase, without accents or punctuation, with single
 * spaces. "Co-op/Intern" and "Co-op, Intern" are the same.
 */
export function normalizeName(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** The lowercase hex SHA-256 of a text's UTF-8 bytes. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Hex characters of the hash in a fallback key: 64 bits, plenty for one person's postings. */
const FALLBACK_HASH_LENGTH = 16;

/** What a listing's apply URL says about the job: its key, and its board when it is on one. */
export interface ListingKey {
  key: JobKey;
  ats: Ats;
  boardToken: string | null;
  postingId: string | null;
}

function atsOf(url: string): Ats {
  try {
    const host = new URL(url).hostname;
    return /(?:^|\.)myworkday(?:jobs|site)\.com$/.test(host) ? 'workday' : 'other';
  } catch {
    return 'other';
  }
}

/**
 * A listing's job key. On Greenhouse, Lever or Ashby it is `{ats}:{board}:{postingId}`, read with
 * `parseBoardUrl`, so the same posting gets the same key from every list and board that names it.
 *
 * Anywhere else it is `{source}:{hash}`, where the hash covers the normalized company and title and
 * the link exactly as the source listed it. The link is there because one company often lists the
 * same title twice as two postings: the saved lists have 41 such pairs in Canada, like Pinterest's
 * Winter and Fall "Software Engineer Intern". A short link keys by the short link, so following
 * it or failing to doesn't change the key. The same posting in two lists gets two fallback keys;
 * `buildJobs` merges them when company, title and a location match.
 */
export async function listingKey(
  listing: Pick<Listing, 'source' | 'company' | 'title' | 'applyUrl' | 'sourceUrl'>,
): Promise<ListingKey> {
  const board = parseBoardUrl(listing.applyUrl);
  if (board) {
    return {
      key: `${board.ats}:${board.token}:${board.postingId}`,
      ats: board.ats,
      boardToken: board.token,
      postingId: board.postingId,
    };
  }
  const identity = [
    normalizeName(listing.company),
    normalizeName(listing.title),
    listing.sourceUrl,
  ];
  const hash = (await sha256Hex(JSON.stringify(identity))).slice(0, FALLBACK_HASH_LENGTH);
  return {
    key: `${listing.source}:${hash}`,
    ats: atsOf(listing.applyUrl),
    boardToken: null,
    postingId: null,
  };
}

/** Whitespace collapsed and trimmed, for text where spacing says nothing. */
function squash(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** The parts of a posting whose change means it should be triaged again. */
export interface JobContent {
  title: string;
  locations: readonly string[];
  terms: readonly string[];
  description: string | null;
}

/**
 * The SHA-256 of the normalized title, the sorted locations, the sorted terms and the description.
 * The pipeline compares it with the stored one to tell a changed posting from one seen again (#7).
 */
export async function contentHash(content: JobContent): Promise<string> {
  const sorted = (values: readonly string[]) => [...new Set(values.map(squash))].sort();
  return sha256Hex(
    JSON.stringify([
      normalizeName(content.title),
      sorted(content.locations),
      sorted(content.terms),
      content.description === null ? null : squash(content.description),
    ]),
  );
}
