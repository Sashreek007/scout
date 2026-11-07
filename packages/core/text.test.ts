import { describe, expect, it } from 'vitest';
import { capUtf8, decodeEntities, htmlToText } from './text';

describe('decodeEntities', () => {
  it('decodes named, decimal and hex entities once', () => {
    expect(
      decodeEntities('R&amp;D &lt;b&gt; &quot;hi&quot; &#39;x&#39; &#x2014; caf&eacute;'),
    ).toBe('R&D <b> "hi" \'x\' — café');
    expect(decodeEntities('&amp;lt;')).toBe('&lt;');
  });

  it('leaves unknown entities and bad code points alone', () => {
    expect(decodeEntities('&unknown; &#99999999; &#xD800;')).toBe('&unknown; &#99999999; &#xD800;');
  });
});

describe('htmlToText', () => {
  it('keeps the words and the line breaks, and drops the markup', () => {
    const html =
      '<h2><strong>Who are we?</strong></h2><p style="x">Cohere builds&nbsp;AI.</p>' +
      '<ul><li>Python</li><li>Go &amp; Rust</li></ul><div>Line one<br>Line two</div>' +
      '<style>p { color: red }</style><script>alert(1)</script><p>  Spaced   out  </p>';
    expect(htmlToText(html)).toBe(
      'Who are we?\n\nCohere builds AI.\n\n- Python\n- Go & Rust\n\nLine one\nLine two\n\nSpaced out',
    );
  });

  it('keeps table cells apart', () => {
    expect(htmlToText('<table><tr><th>City</th><td>Toronto</td></tr></table>')).toBe(
      'City Toronto',
    );
  });

  it('gives an empty string for markup with no words', () => {
    expect(htmlToText('<div><br/></div>')).toBe('');
  });
});

describe('capUtf8', () => {
  it('cuts at a byte limit without splitting a character', () => {
    expect(capUtf8('abc', 10)).toBe('abc');
    expect(capUtf8('abcdef', 4)).toBe('abcd');
    // "é" is two bytes, so a limit of 2 can't keep half of it.
    expect(capUtf8('aé', 2)).toBe('a');
    expect(new TextEncoder().encode(capUtf8('😀'.repeat(100), 51)).length).toBe(48);
  });
});
