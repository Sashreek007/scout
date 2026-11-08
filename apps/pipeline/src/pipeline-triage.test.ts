import { ClaudeTriage, createClaudeClient } from '@scout/adapters';
import {
  InMemoryStore,
  aProfile,
  startFakeClaude,
  startFakeJobBoard,
  type ClaudeRecording,
} from '@scout/testkit';
import { describe, expect, it } from 'vitest';
import { runPipeline } from './pipeline';
import { clockAt, fixturePipeline } from './pipeline.fixture';

const reply = (contains: string[], decision: string, score: number): ClaudeRecording => ({
  match: { contains },
  response: {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          decision,
          score,
          reasons: ['From the recording'],
          lead: 'backend',
          flags: [],
        }),
      },
    ],
  },
});

describe('runPipeline with ClaudeTriage against the fake Claude', { timeout: 30_000 }, () => {
  it('triages up to 60 recent postings in one batch, records tokens and cost, and queues the best', async () => {
    const board = await startFakeJobBoard();
    // TechInsights' two co-ops score 88 and Acumatica's 75; everything else is a maybe.
    const claude = await startFakeClaude({
      recordings: [
        reply(['Company: TechInsights'], 'apply', 88),
        reply(['Company: Acumatica'], 'apply', 75),
        reply(['Triage this posting.'], 'maybe', 50),
      ],
    });
    try {
      const store = new InMemoryStore();
      await store.profile.put(aProfile());
      const client = createClaudeClient({ apiKey: 'fake', baseURL: claude.url, maxRetries: 0 });
      const day = new Date('2026-11-05T14:00:00Z');
      const run = await runPipeline(
        await fixturePipeline(
          store,
          board,
          clockAt(day),
          (settings) => new ClaudeTriage({ client, settings, sleep: () => Promise.resolve() }),
        ),
      );

      expect(claude.batches).toEqual([{ id: 'msgbatch_fake_1', size: 60, canceled: false }]);
      expect(run.triageDecisions).toEqual({ apply: 3, maybe: 57 });
      // Every call after the first reads the instructions and profile from the cache.
      expect(run.tokens.cacheRead).toBe(run.tokens.cacheWrite * 59);
      expect(run.costUsd).toBeGreaterThan(0);
      expect(run.costUsd).toBeLessThan(0.05);

      // Only the two at or above autoQueueScore (80) are queued.
      const queued = await store.applications.list({ stage: 'queued' });
      expect(queued.map((app) => app.company)).toEqual(['TechInsights', 'TechInsights']);
      const triaged = (await store.jobs.list()).filter((job) => job.triage !== null);
      expect(triaged).toHaveLength(60);
    } finally {
      await claude.close();
      await board.close();
    }
  });
});
