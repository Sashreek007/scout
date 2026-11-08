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

  it('reads a long marked system prefix from the cache after the first request writes it', async () => {
    const system = [{ type: 'text', text: 'x'.repeat(4000), cache_control: { type: 'ephemeral' } }];
    const ask = () =>
      post(claude.url, {
        model: 'claude-haiku-5-5',
        system,
        messages: [{ role: 'user', content: 'Northwind Robotics: Software Developer Intern' }],
      });
    const first = (await ask()).body.usage as Record<string, number>;
    const second = (await ask()).body.usage as Record<string, number>;
    expect(first.cache_creation_input_tokens).toBeGreaterThan(512);
    expect(first.cache_read_input_tokens).toBe(0);
    expect(second.cache_read_input_tokens).toBe(first.cache_creation_input_tokens);
  });

  it('never caches a prefix under 512 tokens', async () => {
    const system = [{ type: 'text', text: 'short', cache_control: { type: 'ephemeral' } }];
    const body = {
      model: 'claude-haiku-5-5',
      system,
      messages: [{ role: 'user', content: 'Northwind Robotics Software Developer Intern' }],
    };
    await post(claude.url, body);
    const usage = (await post(claude.url, body)).body.usage as Record<string, number>;
    expect(usage.cache_read_input_tokens).toBe(0);
  });

  it('runs a message batch: created in progress, then ended with JSONL results', async () => {
    const res = await fetch(`${claude.url}/v1/messages/batches`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            custom_id: 'a',
            params: {
              model: 'claude-haiku-5-5',
              messages: [{ role: 'user', content: 'Northwind Robotics Software Developer Intern' }],
            },
          },
          {
            custom_id: 'b',
            params: {
              model: 'claude-haiku-5-5',
              messages: [{ role: 'user', content: 'nobody recorded this' }],
            },
          },
        ],
      }),
    });
    const created = (await res.json()) as { id: string; processing_status: string };
    expect(created.processing_status).toBe('in_progress');
    const batch = (await (
      await fetch(`${claude.url}/v1/messages/batches/${created.id}`)
    ).json()) as {
      processing_status: string;
      results_url: string;
    };
    expect(batch.processing_status).toBe('ended');
    const lines = (await (await fetch(batch.results_url)).text())
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { custom_id: string; result: { type: string } });
    expect(lines.map((line) => [line.custom_id, line.result.type])).toEqual([
      ['a', 'succeeded'],
      ['b', 'errored'],
    ]);
    expect(claude.batches.at(-1)).toEqual({ id: created.id, size: 2, canceled: false });
  });
});
