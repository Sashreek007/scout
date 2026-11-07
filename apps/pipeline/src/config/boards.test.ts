import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadBoards } from './boards';

function file(contents: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'scout-boards-')), 'boards.yaml');
  writeFileSync(path, contents);
  return path;
}

describe('loadBoards', () => {
  it('reads sources/boards.yaml', async () => {
    expect(await loadBoards('sources/boards.yaml')).toEqual({
      greenhouse: ['tribalscale'],
      lever: ['eqbank'],
      ashby: ['cohere'],
    });
  });

  it('writes tokens the way scout compares them, once each, and allows an empty list', async () => {
    const path = file('greenhouse: [TribalScale, tribalscale]\nlever: [CesiumAstro]\nashby:\n');
    expect(await loadBoards(path)).toEqual({
      greenhouse: ['tribalscale'],
      lever: ['CesiumAstro'],
      ashby: [],
    });
    expect(await loadBoards(file(''))).toEqual({ greenhouse: [], lever: [], ashby: [] });
  });

  it('names every problem in a broken file', async () => {
    const path = file('greenhouse: [ok, "a/b"]\nlever: eqbank\nworkday: [nvidia]\n');
    await expect(loadBoards(path)).rejects.toThrow(
      /greenhouse\.1[\s\S]*not a board token[\s\S]*lever[\s\S]*workday/,
    );
  });
});
