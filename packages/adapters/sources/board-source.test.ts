import type { BoardAts, BoardRef } from '@scout/core';
import { startFakeJobBoard, type FakeJobBoard } from '@scout/testkit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { feedFor as feed, FEEDS } from './board-feeds.fixture';
import { BOARD_REQUESTS } from './board-source';
import { createBoardSources, type BoardSourcesOptions } from './create-board-sources';

const ref = (ats: BoardAts, token: string): BoardRef => ({ ats, token, company: null });
const SAVED = [ref('greenhouse', 'tribalscale'), ref('lever', 'eqbank'), ref('ashby', 'cohere')];

describe('the board sources', () => {
  let board: FakeJobBoard;
  beforeAll(async () => {
    board = await startFakeJobBoard();
  });
  afterAll(() => board.close());

  function sources(boards: BoardRef[], options: Partial<BoardSourcesOptions> = {}) {
    return createBoardSources({
      boards,
      feeds: FEEDS,
      rewrite: board.rewrite,
      sleep: () => Promise.resolve(),
      ...options,
    });
  }
  const fetchAll = (boards: BoardRef[], options: Partial<BoardSourcesOptions> = {}) =>
    Promise.all(sources(boards, options).map((source) => source.fetch()));

  it('calls each feed with the board token filled in, saying who it is', async () => {
    const before = board.requestUrls.length;
    const [greenhouse, lever, ashby] = sources(SAVED);
    expect([greenhouse.id, lever.id, ashby.id]).toEqual(['greenhouse', 'lever', 'ashby']);
    await Promise.all([greenhouse.fetch(), lever.fetch(), ashby.fetch()]);
    expect(board.requestUrls.slice(before).sort()).toEqual([
      '/api.ashbyhq.com/posting-api/job-board/cohere?includeCompensation=true',
      '/api.lever.co/v0/postings/eqbank?mode=json',
      '/boards-api.greenhouse.io/v1/boards/tribalscale/jobs?content=true',
    ]);
    expect(board.userAgents.slice(before)).toEqual(
      Array.from({ length: 3 }, () => 'scout/0.1 (personal job search)'),
    );
  });

  it('sends a token with a space, like an Ashby board name, to the right path', async () => {
    const before = board.requestUrls.length;
    const [, , ashby] = await fetchAll([ref('ashby', 'hippocratic ai')]);
    expect(board.requestUrls.slice(before)).toEqual([
      '/api.ashbyhq.com/posting-api/job-board/hippocratic ai?includeCompensation=true',
    ]);
    expect(ashby?.skipped.map((s) => s.target)).toEqual(['ashby:hippocratic ai']);
  });

  it('skips a board that answers 404 and notes it, without failing the source', async () => {
    const [greenhouse] = await fetchAll([ref('greenhouse', 'tribalscale'), ref('greenhouse', 'gone')]);
    expect(greenhouse?.listings).toHaveLength(1);
    expect(greenhouse?.skipped).toEqual([
      { target: 'greenhouse:gone', status: 404, message: 'greenhouse:gone answered 404, so it was skipped' },
    ]);
  });

  it('returns an empty batch when every board is gone', async () => {
    const [, lever] = await fetchAll([ref('lever', 'gone1'), ref('lever', 'gone2')]);
    expect(lever).toMatchObject({ listings: [], fetched: 0, invalid: 0 });
    expect(lever?.skipped.map((s) => s.status)).toEqual([404, 404]);
  });

  it('skips a board that times out or keeps failing, and notes why', async () => {
    board.script(feed('greenhouse', 'slow'), [{ delayMs: 300 }, { delayMs: 300 }]);
    board.script(feed('greenhouse', 'down'), [{ status: 503 }, { status: 503 }]);
    const [greenhouse] = await fetchAll(
      [ref('greenhouse', 'slow'), ref('greenhouse', 'down'), ref('greenhouse', 'tribalscale')],
      { timeoutMs: 100 },
    );
    expect(greenhouse?.listings).toHaveLength(1);
    const [slow, down] = greenhouse?.skipped ?? [];
    expect(slow).toMatchObject({ target: 'greenhouse:slow', status: null });
    expect(slow?.message).toContain('timed out after 100 ms');
    expect(down).toMatchObject({ target: 'greenhouse:down', status: 503 });
    expect(down?.message).toContain('answered 503');
  });

  it("skips a board whose answer is not that board's feed", async () => {
    board.script(feed('ashby', 'odd'), [{ status: 200, body: '{"surprise":true}' }]);
    const [, , ashby] = await fetchAll([ref('ashby', 'odd'), ref('ashby', 'cohere')]);
    expect(ashby?.skipped).toEqual([
      { target: 'ashby:odd', status: 200, message: 'ashby:odd did not answer with an Ashby job board' },
    ]);
    expect(ashby?.listings).toHaveLength(3);
  });

  it('fails the source when no board could be read for a reason other than 404', async () => {
    board.script(feed('lever', 'down1'), [{ status: 503 }, { status: 503 }]);
    const [, lever] = sources([ref('lever', 'down1'), ref('lever', 'gone')]);
    await expect(lever.fetch()).rejects.toThrow(
      /^lever: none of the 2 boards could be read\. lever:down1: .*answered 503/,
    );
  });

  it('reads nothing and fails nothing when it has no boards', async () => {
    const [greenhouse] = await fetchAll([ref('lever', 'eqbank')]);
    expect(greenhouse).toEqual({ listings: [], fetched: 0, invalid: 0, skipped: [] });
  });

  it('runs at most 4 board requests at once, across all three sources', async () => {
    const own = await startFakeJobBoard();
    try {
      const boards: BoardRef[] = [];
      for (const ats of ['greenhouse', 'lever', 'ashby'] as const) {
        for (let i = 0; i < 4; i++) {
          const token = `${ats}${String(i)}`;
          boards.push(ref(ats, token));
          own.script(feed(ats, token), [
            { status: 200, body: ats === 'lever' ? '[]' : '{"jobs":[]}', delayMs: 50 },
          ]);
        }
      }
      const batches = await Promise.all(
        createBoardSources({ boards, feeds: FEEDS, rewrite: own.rewrite }).map((s) => s.fetch()),
      );
      expect(batches.map((b) => b.skipped)).toEqual([[], [], []]);
      expect(own.requests).toHaveLength(12);
      expect(own.peakInFlight()).toBe(4);
    } finally {
      await own.close();
    }
  });

  it('gives each board request 20 seconds, and one retry', () => {
    expect(BOARD_REQUESTS).toEqual({ concurrency: 4, timeoutMs: 20_000, retries: 1 });
  });
});
