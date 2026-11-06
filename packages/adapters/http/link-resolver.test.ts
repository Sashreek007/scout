import { startFakeJobBoard, type FakeJobBoard } from '@scout/testkit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLinkResolver } from './link-resolver';

describe('following short links', () => {
  let board: FakeJobBoard;
  let resolve: (url: string) => Promise<string | null>;
  beforeAll(async () => {
    board = await startFakeJobBoard();
    resolve = createLinkResolver({ rewrite: board.rewrite }).resolve;
  });
  afterAll(() => board.close());

  it('follows redirects to the real apply URL', async () => {
    board.script('https://go.vansh.nyc/a1', [
      { status: 301, headers: { location: 'https://jobs.lever.co/acme/123' } },
    ]);
    board.script('https://jobs.lever.co/acme/123', [
      { status: 302, headers: { location: '/acme/123/apply' } },
    ]);
    board.script('https://jobs.lever.co/acme/123/apply', [{ status: 200 }]);
    expect(await resolve('https://go.vansh.nyc/a1')).toBe('https://jobs.lever.co/acme/123/apply');
    expect(board.userAgents.at(-1)).toBe('scout/0.1 (personal job search)');
  });

  it('keeps the destination even when that page is gone', async () => {
    board.script('https://go.vansh.nyc/gone', [
      { status: 302, headers: { location: 'https://job-boards.greenhouse.io/acme/jobs/9' } },
    ]);
    // The destination isn't scripted, so the fake board answers 404 there.
    expect(await resolve('https://go.vansh.nyc/gone')).toBe(
      'https://job-boards.greenhouse.io/acme/jobs/9',
    );
  });

  it('gives up after 5 redirects', async () => {
    for (let i = 0; i < 6; i++) {
      board.script(`https://go.vansh.nyc/loop${String(i)}`, [
        { status: 302, headers: { location: `https://go.vansh.nyc/loop${String(i + 1)}` } },
      ]);
    }
    expect(await resolve('https://go.vansh.nyc/loop0')).toBeNull();
  });

  it('gives up on a link that does not redirect at all', async () => {
    board.script('https://go.vansh.nyc/broken', [{ status: 404 }]);
    expect(await resolve('https://go.vansh.nyc/broken')).toBeNull();
  });

  it('gives up when following takes longer than the timeout', async () => {
    const slow = createLinkResolver({ rewrite: board.rewrite, timeoutMs: 100 });
    board.script('https://go.vansh.nyc/slow', [
      { status: 302, headers: { location: 'https://jobs.lever.co/x/1' }, delayMs: 400 },
    ]);
    expect(await slow.resolve('https://go.vansh.nyc/slow')).toBeNull();
  });
});
