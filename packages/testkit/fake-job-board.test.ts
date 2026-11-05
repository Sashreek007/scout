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

  it('never serves a file outside the fixtures folder', async () => {
    const res = await fetch(`${board.url}/..%2f..%2fpackage.json`);
    expect(res.status).toBe(404);
  });
});
