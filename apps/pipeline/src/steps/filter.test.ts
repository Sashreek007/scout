import { GitHubListSource, createHttpClient } from '@scout/adapters';
import { filterJob, type BuiltJob, type Listing } from '@scout/core';
import { aJob, aProfile, startFakeJobBoard } from '@scout/testkit';
import { describe, expect, it } from 'vitest';
import { loadSources } from '../config/sources';
import { filterJobs } from './filter';

describe('filterJobs', () => {
  it('sets each job its filter result and counts the reasons', () => {
    const jobs: BuiltJob[] = [
      { change: 'new', job: aJob({ filter: null }) },
      {
        change: 'unchanged',
        job: aJob({ key: 'greenhouse:northwind:2', title: 'Hardware Intern', locations: [] }),
      },
      { change: 'changed', job: aJob({ key: 'greenhouse:northwind:3' }) },
    ];
    const { jobs: filtered, reasons } = filterJobs(
      jobs,
      aProfile(),
      new Map([['greenhouse:northwind:3', 'applied' as const]]),
    );
    expect(filtered.map((built) => [built.change, built.job.filter?.reasons])).toEqual([
      ['new', []],
      ['unchanged', ['location', 'role']],
      ['changed', ['already_applied']],
    ]);
    expect(reasons).toEqual({ location: 1, role: 1, already_applied: 1 });
  });
});

describe('the location filter on the saved Simplify list', () => {
  it('keeps 462 of its 5,365 active rows', async () => {
    // #8 pins 473, which was counted live at another time on 2026-11-05. The saved copy is commit
    // f084d89 and has 462; even every row that mentions "Canada" in any field gives only 463.
    const board = await startFakeJobBoard();
    try {
      const { githubLists } = await loadSources('sources/sources.yaml');
      const simplify = githubLists.find((list) => list.name === 'simplify');
      if (!simplify) throw new Error('sources.yaml has no simplify list');
      const source = new GitHubListSource(simplify, {
        http: createHttpClient({ sleep: () => Promise.resolve() }),
        baseUrl: `${board.url}/raw.githubusercontent.com`,
      });
      const { listings } = await source.fetch();
      const profile = aProfile();
      const kept = listings.filter(
        (listing: Listing) =>
          !filterJob({ job: listing, profile, applicationStage: null }).reasons.includes(
            'location',
          ),
      );
      expect([listings.length, kept.length]).toEqual([5365, 462]);
    } finally {
      await board.close();
    }
  });
});
