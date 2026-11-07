// Plain text from the HTML that job boards send, so descriptions are stored as text (section 6).

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
  bull: '•',
  middot: '·',
  copy: '©',
  reg: '®',
  trade: '™',
  deg: '°',
  euro: '€',
  pound: '£',
  laquo: '«',
  raquo: '»',
  // French, for Quebec postings.
  agrave: 'à',
  acirc: 'â',
  ccedil: 'ç',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  euml: 'ë',
  icirc: 'î',
  iuml: 'ï',
  ocirc: 'ô',
  oelig: 'œ',
  ugrave: 'ù',
  ucirc: 'û',
  uuml: 'ü',
  Agrave: 'À',
  Ccedil: 'Ç',
  Eacute: 'É',
  Egrave: 'È',
  Ecirc: 'Ê',
};

function fromCodePoint(code: number): string | null {
  const valid = code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff);
  return valid ? String.fromCodePoint(code) : null;
}

/** Decodes HTML entities once: `&amp;lt;` becomes `&lt;`. Unknown entities are left as they are. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
    if (name.startsWith('#')) {
      const hex = name[1] === 'x' || name[1] === 'X';
      return fromCodePoint(Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10)) ?? entity;
    }
    return NAMED[name] ?? entity;
  });
}

const BLOCK =
  /<\/?(?:p|div|h[1-6]|ul|ol|table|tr|section|article|blockquote|header|footer)\b[^>]*>|<hr\b[^>]*>/gi;

/**
 * Posting HTML as plain text: scripts, styles and tags dropped, paragraphs and headings separated
 * by a blank line, list items on their own lines starting with "- ", and entities decoded.
 */
export function htmlToText(html: string): string {
  const text = decodeEntities(
    html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, ' ')
      .replace(/<br\b[^>]*>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n- ')
      .replace(BLOCK, '\n\n')
      .replace(/<[^>]*>/g, ''),
  );
  return text
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Cuts text to at most `maxBytes` of UTF-8, never in the middle of a character. */
export function capUtf8(text: string, maxBytes: number): string {
  const bytes = encoder.encode(text);
  if (bytes.length <= maxBytes) return text;
  let end = maxBytes;
  // Back up over continuation bytes (10xxxxxx) to the start of the character that doesn't fit.
  while (end > 0 && ((bytes[end] ?? 0) & 0xc0) === 0x80) end -= 1;
  return decoder.decode(bytes.subarray(0, end));
}
