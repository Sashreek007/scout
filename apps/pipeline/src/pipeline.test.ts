import { DESCRIPTION_MAX_BYTES } from '@scout/core';
import {
  InMemoryStore,
  aCreationEvent,
  aJob,
  anApplication,
  aProfile,
  startFakeJobBoard,
  type FakeJobBoard,
} from '@scout/testkit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runId, runPipeline } from './pipeline';
import { clockAt, fixturePipeline } from './pipeline.fixture';

const DAY_1 = new Date('2026-11-05T14:00:00Z');
const DAY_2 = new Date('2026-11-06T14:00:00Z');

// Each run reads 20,674 saved rows, so these get more than the default 5 seconds under coverage.
async function withProfile(): Promise<InMemoryStore> {
  const store = new InMemoryStore();
  await store.profile.put(aProfile());
  return store;
}

describe('runPipeline on the saved lists and boards', { timeout: 30_000 }, () => {
  let board: FakeJobBoard;
  beforeEach(async () => {
    board = await startFakeJobBoard();
  });
  afterEach(async () => {
    await board.close();
  });

  it('stores each posting in Canada once, and a second run creates nothing new', async () => {
    const store = await withProfile();
    const first = await runPipeline(await fixturePipeline(store, board, clockAt(DAY_1)));
    const stored = await store.jobs.list();
    // 462 Simplify rows and 288 vansh rows are in Canada, and 21 board postings. The ones that are
    // one posting merge, which leaves 647 jobs. The 6,205 postings elsewhere aren't stored.
    expect(first.jobs).toEqual({
      new: 647,
      changed: 0,
      unchanged: 0,
      outsideCanada: 6205,
      missed: 0,
      inactive: 0,
      applicationsClosed: 0,
    });
    expect(stored).toHaveLength(first.jobs.new);

    const second = await runPipeline(await fixturePipeline(store, board, clockAt(DAY_2)));
    const again = await store.jobs.list();
    expect(second.jobs).toEqual({ ...first.jobs, new: 0, unchanged: first.jobs.new });
    expect(again.map((job) => job.key).sort()).toEqual(stored.map((job) => job.key).sort());
    for (const job of again) {
      expect(job.firstSeenAt).toEqual(DAY_1);
      expect(job.lastSeenAt).toEqual(DAY_2);
    }
  });

  it('keys without "/", plain text descriptions under 50 KB, and one source name each', async () => {
    const store = await withProfile();
    await runPipeline(await fixturePipeline(store, board, clockAt(DAY_1)));
    const jobs = await store.jobs.list();
    expect(new Set(jobs.map((job) => job.applyUrl)).size).toBe(jobs.length);
    for (const job of jobs) {
      expect(job.key).not.toContain('/');
      const names = job.sources.map((ref) => ref.name);
      expect(new Set(names).size).toBe(names.length);
      if (job.description === null) continue;
      expect(job.description).not.toMatch(/<\/?[a-z][^>]*>/i);
      expect(job.description).not.toMatch(/&(?:lt|gt|amp|nbsp);/);
      expect(new TextEncoder().encode(job.description).length).toBeLessThanOrEqual(
        DESCRIPTION_MAX_BYTES,
      );
    }
    // A short link that couldn't be followed still finds its job: 117 postings are in both lists
    // and 20 vansh rows joined a board job.
    const bySources = (names: string[]) =>
      jobs.filter((job) => names.every((name) => job.sources.some((ref) => ref.name === name)))
        .length;
    expect({
      simplifyAndVansh: bySources(['simplify', 'vansh']),
      vanshOnBoards: jobs.filter(
        (job) => job.boardToken !== null && job.sources.some((ref) => ref.name === 'vansh'),
      ).length,
      boardAndList: jobs.filter(
        (job) =>
          job.sources.some((ref) => ['greenhouse', 'lever', 'ashby'].includes(ref.name)) &&
          job.sources.some((ref) => ['simplify', 'vansh'].includes(ref.name)),
      ).length,
    }).toEqual({ simplifyAndVansh: 117, vanshOnBoards: 20, boardAndList: 8 });
  });

  it('records the run with its counts per source', async () => {
    const store = await withProfile();
    const run = await runPipeline(await fixturePipeline(store, board, clockAt(DAY_1)));
    expect(await store.runs.get(runId(DAY_1))).toEqual(run);
    expect(run.id).toBe('2026-11-05T14-00-00Z-pipeline');
    const counts = (fetched: number, valid: number, made: number) => ({
      fetched,
      valid,
      invalid: 0,
      new: made,
      changed: 0,
    });
    expect(run.sources).toEqual({
      simplify: counts(17653, 5365, 462),
      vansh: counts(3021, 2193, 289),
      greenhouse: counts(15, 1, 1),
      lever: counts(82, 17, 17),
      ashby: counts(124, 3, 3),
    });
    // Most boards the lists name have no saved copy, so the fake board answers 404 for them.
    expect(run.status).toBe('partial');
    expect(run.errors.every((error) => error.message.includes('404'))).toBe(true);
  });

  it('runs the hard filters on every job it saw and counts what each rule dropped', async () => {
    const store = await withProfile();
    const run = await runPipeline(await fixturePipeline(store, board, clockAt(DAY_1)));
    const jobs = await store.jobs.list();
    expect(jobs.every((job) => job.filter !== null)).toBe(true);
    // Of the 647 jobs, the role rule drops hardware, analog, product and business roles, the term
    // rule the 2026 terms (the example profile starts in January 2027), and the values rule five
    // General Dynamics UK rows. None of the saved list rows carry a description, so no
    // eligibility clause can show up in them.
    expect(run.filterReasons).toEqual({ role: 123, term: 65, values: 5 });
    // 473 pass, the same number as #8's location count only by chance. 178 of them have no
    // known term, like Simplify's "N/A" or a vansh season other than Summer, and are flagged.
    expect(jobs.filter((job) => job.filter?.passed).length).toBe(473);
    expect(jobs.filter((job) => job.filter?.flags.includes('term_unknown')).length).toBe(178);
  });

  it('closes a posting no source listed for three runs, and leaves one whose board failed', async () => {
    const store = await withProfile();
    // Simplify is read every run and never lists this job, so each run is a miss.
    const gone = aJob({
      key: 'simplify:0123456789abcdef',
      ats: 'other',
      boardToken: null,
      postingId: null,
      applyUrl: 'https://careers.example.com/jobs/1',
      sources: [{ name: 'simplify', url: 'https://careers.example.com/jobs/1' }],
    });
    // Acme's board has no saved copy, so it answers 404 and is never read: never a miss.
    const unread = aJob({
      key: 'greenhouse:acme:1',
      boardToken: 'acme',
      postingId: '1',
      applyUrl: 'https://job-boards.greenhouse.io/acme/jobs/1',
      sources: [{ name: 'greenhouse', url: null }],
    });
    await store.jobs.putMany([gone, unread]);
    const review = anApplication({ jobKey: gone.key, stage: 'queued' });
    await store.applications.create(review, aCreationEvent(review));

    const days = [DAY_1, DAY_2, new Date('2026-11-07T14:00:00Z')];
    const runs = [];
    for (const day of days)
      runs.push(await runPipeline(await fixturePipeline(store, board, clockAt(day))));

    expect(
      runs.map((run) => [run.jobs.missed, run.jobs.inactive, run.jobs.applicationsClosed]),
    ).toEqual([
      [1, 0, 0],
      [1, 0, 0],
      [1, 1, 1],
    ]);
    expect(await store.jobs.get(gone.key)).toMatchObject({ active: false, missedRuns: 3 });
    expect(await store.jobs.get(unread.key)).toMatchObject({ active: true, missedRuns: 0 });
    expect((await store.applications.events(gone.key)).at(-1)).toEqual({
      from: 'queued',
      to: 'closed',
      by: 'pipeline',
      at: days[2],
      detail: 'not listed for 3 runs in a row',
    });

    // A fourth run doesn't count it again or write it.
    const fourth = await runPipeline(
      await fixturePipeline(store, board, clockAt(new Date('2026-11-08T14:00:00Z'))),
    );
    expect(fourth.jobs.missed).toBe(0);
    expect(await store.applications.events(gone.key)).toHaveLength(2);
  });

  it('sets a job that comes back active again, and never reopens its closed application', async () => {
    const store = await withProfile();
    await runPipeline(await fixturePipeline(store, board, clockAt(DAY_1)));
    const [listed] = await store.jobs.list();
    if (!listed) throw new Error('nothing was stored');
    await store.jobs.put({ ...listed, active: false, missedRuns: 3 });
    const app = anApplication({ jobKey: listed.key, stage: 'queued' });
    await store.applications.create(app, aCreationEvent(app));
    await store.moveStage(listed.key, { from: 'queued', to: 'closed', by: 'pipeline', at: DAY_1 });

    await runPipeline(await fixturePipeline(store, board, clockAt(DAY_2)));
    expect(await store.jobs.get(listed.key)).toMatchObject({ active: true, missedRuns: 0 });
    expect((await store.applications.get(listed.key))?.stage).toBe('closed');
  });
});
