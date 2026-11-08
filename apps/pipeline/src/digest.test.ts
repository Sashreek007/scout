import { NO_USAGE, type Llm } from '@scout/core';
import {
  FakeNotifier,
  InMemoryStore,
  aProfile,
  aQuestion,
  startFakeJobBoard,
  type FakeJobBoard,
} from '@scout/testkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runPipeline, type PipelineDeps } from './pipeline';
import { clockAt, fixturePipeline } from './pipeline.fixture';

const DAY = new Date('2026-11-05T14:00:00Z');

/** Calls every job a skip, so nothing in the run is new. */
const everyJobSkip: Pick<Llm, 'triage'> = {
  triage: (jobs) =>
    Promise.resolve({
      outcomes: jobs.map((job) => ({
        jobKey: job.key,
        result: {
          ok: true as const,
          triage: {
            decision: 'skip' as const,
            score: 10,
            reasons: ['No'],
            lead: 'backend' as const,
            flags: [],
          },
        },
        model: 'fixture',
      })),
      usage: { ...NO_USAGE },
      costUsd: 0,
    }),
};

describe('the digest after each run', { timeout: 30_000 }, () => {
  let board: FakeJobBoard;
  beforeEach(async () => {
    board = await startFakeJobBoard();
  });
  afterEach(async () => {
    await board.close();
  });

  async function setup(changes: Partial<PipelineDeps> = {}) {
    const store = new InMemoryStore();
    await store.profile.put(aProfile());
    const notifier = new FakeNotifier();
    const deps = {
      ...(await fixturePipeline(store, board, clockAt(DAY))),
      notifier,
      dashboardUrl: 'https://scout.example.app',
      ...changes,
    };
    return { store, notifier, deps };
  }

  it('sends one short line that opens Today, and keeps the full digest on the run', async () => {
    const { store, notifier, deps } = await setup();
    await store.questions.put(aQuestion());
    const run = await runPipeline(deps);
    expect(notifier.sent).toEqual([
      {
        kind: 'digest',
        title: '60 new matches, 1 question waiting',
        body: null,
        url: 'https://scout.example.app/today',
      },
    ]);
    expect(run.digest).toMatchObject({
      matches: 60,
      questions: 1,
      sheets: 0,
      failures: [],
      notified: true,
    });
    expect(run.digest?.lines).toHaveLength(10);
    expect((await store.runs.get(run.id))?.digest).toEqual(run.digest);
  });

  it('still sends a line when nothing is new', async () => {
    const { notifier, deps } = await setup({ triager: () => everyJobSkip });
    await runPipeline(deps);
    expect(notifier.sent.map((notice) => notice.title)).toEqual(['No new matches']);
  });

  it('names a source that failed, but not a board that is gone', async () => {
    const { notifier, deps } = await setup();
    const lists = deps.lists;
    deps.lists = (stored) => [
      ...lists(stored),
      { id: 'extra', fetch: () => Promise.reject(new Error('timed out')) },
    ];
    await runPipeline(deps);
    // The 42 boards with no saved copy answer 404, and aren't named.
    expect(notifier.sent[0]?.title).toBe('60 new matches, extra failed');
  });

  it('logs a send that failed after its retries, and the run carries on', async () => {
    const { notifier, deps } = await setup();
    notifier.failing = new Error(
      'FCM reached none of 1 devices (messaging/internal-error), after 3 tries',
    );
    const run = await runPipeline(deps);
    expect(run.status).toBe('partial');
    expect(run.errors.at(-1)).toMatchObject({ step: 'digest', target: null });
    expect(run.digest).toMatchObject({ matches: 60, notified: false });
  });

  it('tells him when the run itself failed', async () => {
    const { store, notifier, deps } = await setup();
    vi.spyOn(store.profile, 'get').mockResolvedValue(null);
    const run = await runPipeline(deps);
    expect(run.status).toBe('failed');
    expect(notifier.sent.map((notice) => notice.title)).toEqual(['No new matches, the run failed']);
  });
});
