import { startFakeJobBoard, type FakeJobBoard } from '@scout/testkit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HttpError, USER_AGENT, createHttpClient } from './http-client';

const FEED = 'https://boards-api.greenhouse.io/v1/boards/northwind/jobs';

describe('the HTTP client', () => {
  let board: FakeJobBoard;
  beforeAll(async () => {
    board = await startFakeJobBoard();
  });
  afterAll(() => board.close());

  function client(timeoutMs = 30_000) {
    const waits: number[] = [];
    const http = createHttpClient({
      timeoutMs,
      sleep: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    });
    return { http, waits };
  }

  it('fetches JSON and says who it is, with nothing personal', async () => {
    const { http } = client();
    const body = (await http.getJson(board.rewrite(FEED))) as { jobs: unknown[] };
    expect(body.jobs).toHaveLength(2);
    expect(board.userAgents.at(-1)).toBe('scout/0.1 (personal job search)');
    expect(USER_AGENT).toBe('scout/0.1 (personal job search)');
  });

  it('retries a server error 3 times, waiting longer each time', async () => {
    const { http, waits } = client();
    board.script(FEED, [{ status: 503 }, { status: 502 }, { status: 500 }]);
    const body = (await http.getJson(board.rewrite(FEED))) as { jobs: unknown[] };
    expect(body.jobs).toHaveLength(2);
    expect(waits).toEqual([1000, 2000, 4000]);
  });

  it('gives up after 3 retries with the last status', async () => {
    const { http, waits } = client();
    board.script(FEED, [{ status: 503 }, { status: 503 }, { status: 503 }, { status: 503 }]);
    const error = await http.getJson(board.rewrite(FEED)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 503, attempts: 4 });
    expect(waits).toHaveLength(3);
  });

  it('times out a slow request, and retries it', async () => {
    const { http } = client(100);
    board.script(FEED, [{ delayMs: 400 }, { delayMs: 400 }, { delayMs: 400 }, { delayMs: 400 }]);
    const error = await http.getJson(board.rewrite(FEED)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).message).toContain('timed out after 100 ms');
    expect((error as HttpError).attempts).toBe(4);
  });

  it('does not retry a 404, which is an answer and not an outage', async () => {
    const { http, waits } = client();
    const error = await http
      .getJson(`${board.url}/api.lever.co/v0/postings/nobody`)
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 404, attempts: 1 });
    expect(waits).toEqual([]);
  });

  it('rejects a body that is not JSON', async () => {
    const { http } = client();
    board.script(FEED, [{ status: 200, body: '<html>maintenance</html>' }]);
    await expect(http.getJson(board.rewrite(FEED))).rejects.toThrow(/not JSON/);
  });
});
