import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFakeJobBoard, type FakeJobBoard } from './fake-job-board';

describe('the fake job board', () => {
  let board: FakeJobBoard;
  beforeAll(async () => {
    board = await startFakeJobBoard();
  });
  afterAll(() => board.close());

  it('serves a saved Greenhouse board at its real path', async () => {
    const res = await fetch(
      board.rewrite('https://boards-api.greenhouse.io/v1/boards/northwind/jobs?content=true'),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = (await res.json()) as { jobs: { title: string }[] };
    expect(body.jobs.map((job) => job.title)).toEqual([
      'Software Developer Intern (Winter 2027)',
      'Senior Robotics Engineer',
    ]);
  });

  it('serves the saved form and the apply page', async () => {
    const form = await fetch(
      board.rewrite(
        'https://boards-api.greenhouse.io/v1/boards/northwind/jobs/4100001?questions=true',
      ),
    );
    expect(((await form.json()) as { questions: unknown[] }).questions).toHaveLength(10);

    const page = await fetch(
      board.rewrite('https://job-boards.greenhouse.io/northwind/jobs/4100001'),
    );
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(await page.text()).toContain('<form id="application-form"');
  });

  it('answers 404 for a board it has no copy of, and records every request', async () => {
    const res = await fetch(`${board.url}/api.lever.co/v0/postings/nobody`);
    expect(res.status).toBe(404);
    expect(board.requests).toContain('/api.lever.co/v0/postings/nobody');
  });

  it('serves a gzipped fixture decompressed, under its real path', async () => {
    const res = await fetch(
      board.rewrite(
        'https://raw.githubusercontent.com/vanshb03/Summer2027-Internships/dev/.github/scripts/listings.json',
      ),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const rows = (await res.json()) as unknown[];
    expect(rows).toHaveLength(3021);
  });

  it('serves the real tribalscale, eqbank and cohere boards at their API paths', async () => {
    const get = async (url: string) => (await fetch(board.rewrite(url))).json();
    const greenhouse = (await get(
      'https://boards-api.greenhouse.io/v1/boards/tribalscale/jobs?content=true',
    )) as { jobs: unknown[] };
    const lever = (await get('https://api.lever.co/v0/postings/eqbank?mode=json')) as unknown[];
    const ashby = (await get(
      'https://api.ashbyhq.com/posting-api/job-board/cohere?includeCompensation=true',
    )) as { jobs: unknown[] };
    expect([greenhouse.jobs.length, lever.length, ashby.jobs.length]).toEqual([15, 82, 124]);
  });

  it('records each request with its query string', async () => {
    await fetch(board.rewrite('https://api.lever.co/v0/postings/eqbank?mode=json'));
    expect(board.requests.at(-1)).toBe('/api.lever.co/v0/postings/eqbank');
    expect(board.requestUrls.at(-1)).toBe('/api.lever.co/v0/postings/eqbank?mode=json');
  });

  it('counts the most requests it answered at once', async () => {
    const own = await startFakeJobBoard();
    try {
      for (const n of [1, 2, 3]) own.script(`/slow/${String(n)}`, [{ delayMs: 100 }]);
      await Promise.all([1, 2, 3].map((n) => fetch(`${own.url}/slow/${String(n)}`)));
      await fetch(`${own.url}/slow/after`);
      expect(own.peakInFlight()).toBe(3);
    } finally {
      await own.close();
    }
  });

  it('plays scripted responses in order, then falls back to the fixture', async () => {
    const real = 'https://boards-api.greenhouse.io/v1/boards/northwind/jobs';
    board.script(real, [
      { status: 503 },
      { status: 302, headers: { location: 'https://example.com/moved' } },
    ]);
    const first = await fetch(board.rewrite(real));
    const second = await fetch(board.rewrite(real), { redirect: 'manual' });
    const third = await fetch(board.rewrite(real));
    expect([first.status, second.status, third.status]).toEqual([503, 302, 200]);
    expect(second.headers.get('location')).toBe('https://example.com/moved');
  });

  it('can delay a scripted response, to test timeouts', async () => {
    board.script('/slow/thing', [{ status: 200, body: 'late', delayMs: 300 }]);
    const started = Date.now();
    const res = await fetch(`${board.url}/slow/thing`);
    expect(await res.text()).toBe('late');
    expect(Date.now() - started).toBeGreaterThanOrEqual(250);
  });

  it('records the user agent of every request', async () => {
    await fetch(`${board.url}/anything`, {
      headers: { 'user-agent': 'scout/0.1 (personal job search)' },
    });
    expect(board.userAgents.at(-1)).toBe('scout/0.1 (personal job search)');
  });

  it('never serves a file outside the fixtures folder', async () => {
    const res = await fetch(`${board.url}/..%2f..%2fpackage.json`);
    expect(res.status).toBe(404);
  });
});
