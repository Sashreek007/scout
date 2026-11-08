import Anthropic from '@anthropic-ai/sdk';
import { ModelsConfigSchema, type TaskModel } from '@scout/core';
import {
  aJob,
  aProfile,
  startFakeClaude,
  type ClaudeRecording,
  type FakeClaude,
} from '@scout/testkit';
import { afterEach, describe, expect, it } from 'vitest';
import { ClaudeTriage } from './claude-triage';

const answer = (decision: string, score: number, reason: string) =>
  JSON.stringify({ decision, score, reasons: [reason], lead: 'backend', flags: [] });

const recording = (contains: string[], text: string, model?: string): ClaudeRecording => ({
  match: { contains, ...(model ? { model } : {}) },
  response: { content: [{ type: 'text', text }] },
});

const refusal = (contains: string[], model: string): ClaudeRecording => ({
  match: { contains, model },
  response: {
    content: [],
    stop_reason: 'refusal',
    stop_details: { type: 'refusal', category: 'cyber', explanation: 'declined to rank this one' },
  },
});

const northwind = aJob();
const maple = aJob({
  key: 'lever:mapleledger:7d1e2f',
  company: 'Maple Ledger',
  title: 'Platform Engineering Co-op',
  description: null,
});
const triageSettings = (overrides: Partial<TaskModel> = {}): TaskModel => ({
  ...ModelsConfigSchema.parse({}).triage,
  ...overrides,
});

describe('ClaudeTriage', () => {
  let claude: FakeClaude | undefined;
  afterEach(async () => {
    await claude?.close();
    claude = undefined;
  });

  async function triage(
    recordings: ClaudeRecording[],
    settings = triageSettings(),
    options: { batchPolls?: number; maxWaitMs?: number } = {},
  ) {
    claude = await startFakeClaude({
      recordings,
      ...(options.batchPolls === undefined ? {} : { batchPolls: options.batchPolls }),
    });
    let now = 0;
    const client = new Anthropic({ apiKey: 'fake', baseURL: claude.url, maxRetries: 0 });
    const triager = new ClaudeTriage({
      client,
      settings,
      sleep: (ms) => {
        now += ms;
        return Promise.resolve();
      },
      clock: () => new Date(now),
      ...(options.maxWaitMs === undefined ? {} : { maxWaitMs: options.maxWaitMs }),
    });
    return triager.triage([northwind, maple], aProfile());
  }

  it('sends one batch to Haiku 5.5 at low effort with the triage schema and a cached prefix', async () => {
    const run = await triage([
      recording(['Northwind Robotics'], answer('apply', 82, 'Backend role in Toronto')),
      recording(['Maple Ledger'], answer('maybe', 55, 'Platform co-op, few details')),
    ]);
    expect(claude?.batches).toEqual([{ id: 'msgbatch_fake_1', size: 2, canceled: false }]);
    for (const body of claude?.bodies ?? []) {
      expect(body).toMatchObject({
        model: 'claude-haiku-5-5',
        output_config: { effort: 'low', format: { type: 'json_schema' } },
        system: [{ type: 'text', cache_control: { type: 'ephemeral' } }],
      });
    }
    expect(run.outcomes).toEqual([
      {
        jobKey: northwind.key,
        result: {
          ok: true,
          triage: {
            decision: 'apply',
            score: 82,
            reasons: ['Backend role in Toronto'],
            lead: 'backend',
            flags: [],
          },
        },
        model: 'claude-haiku-5-5',
      },
      {
        jobKey: maple.key,
        result: {
          ok: true,
          triage: expect.objectContaining({
            decision: 'maybe',
            reasons: ['Title only: no posting text to read', 'Platform co-op, few details'],
          }) as unknown,
        },
        model: 'claude-haiku-5-5',
      },
    ]);
  });

  it('reads the cached instructions on the second call of a run, and counts the tokens', async () => {
    const run = await triage([
      recording(['Northwind Robotics'], answer('apply', 82, 'Backend role')),
      recording(['Maple Ledger'], answer('maybe', 55, 'Platform co-op')),
    ]);
    // The first call writes the instructions and profile to the cache; the second reads them.
    expect(run.usage.cacheWrite).toBeGreaterThan(512);
    expect(run.usage.cacheRead).toBe(run.usage.cacheWrite);
    expect(run.usage.input).toBeGreaterThan(0);
    expect(run.usage.output).toBeGreaterThan(0);
    // Batched Haiku: a fraction of a cent for two postings.
    expect(run.costUsd).toBeGreaterThan(0);
    expect(run.costUsd).toBeLessThan(0.001);
  });

  it('checks stop_reason first, and tries a refused job again on Sonnet 5.5 with fallback on', async () => {
    const run = await triage([
      refusal(['Northwind Robotics'], 'claude-haiku-5-5'),
      recording(['Northwind Robotics'], answer('apply', 80, 'Backend role'), 'claude-sonnet-5-5'),
      recording(['Maple Ledger'], answer('maybe', 55, 'Platform co-op')),
    ]);
    expect(run.outcomes[0]).toMatchObject({
      jobKey: northwind.key,
      result: { ok: true, triage: { score: 80 } },
      model: 'claude-sonnet-5-5',
    });
    const retry = claude?.bodies.at(-1);
    expect(retry).toMatchObject({ model: 'claude-sonnet-5-5', fallbacks: 'default' });
    expect(claude?.batches).toHaveLength(1);
  });

  it('leaves a job untriaged, with the reason, when every model refuses', async () => {
    const run = await triage([
      refusal(['Northwind Robotics'], 'claude-haiku-5-5'),
      refusal(['Northwind Robotics'], 'claude-sonnet-5-5'),
      recording(['Maple Ledger'], answer('maybe', 55, 'Platform co-op')),
    ]);
    expect(run.outcomes[0]).toEqual({
      jobKey: northwind.key,
      result: {
        ok: false,
        reason: 'refusal',
        message: 'claude-sonnet-5-5 refused: declined to rank this one',
      },
      model: 'claude-sonnet-5-5',
    });
    expect(run.outcomes[1]?.result.ok).toBe(true);
  });

  it('turns an answer that breaks the schema, or no answer at all, into an error', async () => {
    const run = await triage([recording(['Northwind Robotics'], '{"decision":"hire"}')]);
    expect(run.outcomes.map((o) => o.result)).toEqual([
      {
        ok: false,
        reason: 'error',
        message: expect.stringContaining("doesn't fit the schema") as unknown,
      },
      {
        ok: false,
        reason: 'error',
        message: 'claude-haiku-5-5: no recording for this request',
      },
    ]);
  });

  it('cancels a batch that has not ended in time, and leaves its jobs for the next run', async () => {
    const run = await triage(
      [
        recording(['Northwind'], answer('apply', 82, 'x')),
        recording(['Maple'], answer('skip', 2, 'y')),
      ],
      triageSettings(),
      { batchPolls: 1000, maxWaitMs: 60_000 },
    );
    expect(claude?.batches).toEqual([{ id: 'msgbatch_fake_1', size: 2, canceled: true }]);
    expect(run.outcomes.map((o) => o.result)).toEqual([
      {
        ok: false,
        reason: 'error',
        message: "batch msgbatch_fake_1 hadn't finished after 1 minutes, so it was cancelled",
      },
      expect.objectContaining({ ok: false }) as unknown,
    ]);
  });

  it('waits for a batch that is still running', async () => {
    const run = await triage(
      [
        recording(['Northwind'], answer('apply', 82, 'x')),
        recording(['Maple'], answer('skip', 2, 'y')),
      ],
      triageSettings(),
      { batchPolls: 3 },
    );
    expect(run.outcomes.every((o) => o.result.ok)).toBe(true);
  });

  it('calls one job at a time when the settings turn batching off', async () => {
    const run = await triage(
      [
        recording(['Northwind'], answer('apply', 82, 'x')),
        recording(['Maple'], answer('skip', 2, 'y')),
      ],
      triageSettings({ batch: false, model: 'claude-sonnet-5-5', effort: 'medium' }),
    );
    expect(claude?.batches).toEqual([]);
    expect(claude?.bodies.map((body) => body.model)).toEqual([
      'claude-sonnet-5-5',
      'claude-sonnet-5-5',
    ]);
    expect(claude?.bodies[0]).toMatchObject({
      output_config: { effort: 'medium' },
      fallbacks: 'default',
    });
    expect(run.outcomes.every((o) => o.result.ok)).toBe(true);
  });
});
