import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSources } from './sources';

describe('loadSources', () => {
  it('reads sources/sources.yaml into the two GitHub lists', async () => {
    const config = await loadSources('sources/sources.yaml');
    expect(config.githubLists).toEqual([
      {
        name: 'simplify',
        repo: 'SimplifyJobs/Summer2027-Internships',
        path: '.github/scripts/listings.json',
        branch: 'dev',
        fallbackBranch: 'main',
        termField: 'terms',
        resolveShortLinks: false,
        certainYears: {},
      },
      {
        name: 'vansh',
        repo: 'vanshb03/Summer2027-Internships',
        path: '.github/scripts/listings.json',
        branch: 'dev',
        fallbackBranch: 'main',
        termField: 'season',
        resolveShortLinks: true,
        certainYears: { Summer: 2027 },
      },
    ]);
  });

  it('names every problem in a broken file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'scout-sources-'));
    const file = join(dir, 'sources.yaml');
    writeFileSync(
      file,
      'github_lists:\n  - name: Simplify\n    repo: SimplifyJobs\n    path: x\n    branch: dev\n    term_field: years\n',
    );
    await expect(loadSources(file)).rejects.toThrow(
      /github_lists\.0\.name[\s\S]*github_lists\.0\.repo[\s\S]*github_lists\.0\.term_field/,
    );
  });
});
