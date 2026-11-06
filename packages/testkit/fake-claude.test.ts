import { TriageSchema } from '@scout/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFakeClaude, type FakeClaude } from './fake-claude';

async function post(url: string, body: unknown) {
  const res = await fetch(`${url}/v1/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe('the fake Claude API', () => {
  let claude: FakeClaude;
  beforeAll(async () => {
    claude = await startFakeClaude();
  });
  afterAll(() => claude.close());

  it('replays the recorded triage for Northwind in the Messages API shape', async () => {
    const { status, body } = await post(claude.url, {
      model: 'claude-haiku-5-5',
      max_tokens: 1024,
      system: 'You triage internship postings for one candidate.',
      messages: [
        { role: 'user', content: 'Northwind Robotics: Software Developer Intern, Toronto' },
      ],
    });
    expect(status).toBe(200);
    expect(body).toMatchObject({ type: 'message', role: 'assistant', model: 'claude-haiku-5-5' });
    const [block] = body.content as { type: string; text: string }[];
    expect(TriageSchema.parse(JSON.parse(block!.text))).toMatchObject({ decision: 'apply' });
  });

  it('answers 404 when nothing was recorded for the request', async () => {
    const { status, body } = await post(claude.url, {
      model: 'claude-sonnet-5-5',
      messages: [{ role: 'user', content: 'Something nobody recorded' }],
    });
    expect(status).toBe(404);
    expect(body).toMatchObject({ type: 'error', error: { type: 'not_found_error' } });
    expect(claude.requests.at(-1)).toEqual({ model: 'claude-sonnet-5-5', matched: false });
  });

  it('rejects a request that is not a Messages API call', async () => {
    expect((await post(claude.url, { prompt: 'hi' })).status).toBe(400);
    expect((await fetch(`${claude.url}/v1/complete`)).status).toBe(404);
  });
});
