/**
 * A question's text reduced to what it asks: lowercase, punctuation removed, whitespace collapsed.
 * The memory pass of the planner and the profile import share it, so "Are you legally eligible to
 * work in Canada?" and "are you legally eligible to work in canada" are the same question.
 */
export function normalizeQuestion(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The ID of a remembered answer: the SHA-256 of the normalized question, as lowercase hex. It uses
 * Web Crypto, so the dashboard in the browser computes the same key as the pipeline.
 */
export async function questionKey(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeQuestion(text));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
