import type { JobSource, Run } from '@scout/core';
import {
  InMemoryStore,
  aProfile,
  aRun,
  startFakeJobBoard,
  type FakeJobBoard,
} from '@scout/testkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runId, runPipeline, type PipelineDeps } from './pipeline';
import { clockAt, fixturePipeline } from './pipeline.fixture';

const START = new Date('2026-11-05T14:00:00Z');
const END = new Date('2026-11-05T14:03:00Z');
const API_KEY = `sk-ant-api03-${'x'.repeat(40)}`;

const broken = (id: string, message: string): JobSource => ({
  id,
  fetch: () => Promise.reject(new Error(message)),
});

describe('the run log', { timeout: 30_000 }, () => {
  let board: FakeJobBoard;
  beforeEach(async () => {
    board = await startFakeJobBoard();
  });
  afterEach(async () => {
    await board.close();
  });

  async function setup(changes: (deps: PipelineDeps) => PipelineDeps = (deps) => deps) {
    const store = new InMemoryStore();
    await store.profile.put(aProfile());
    const deps = await fixturePipeline(store, board, clockAt(START, START, END));
    const puts: Run[] = [];
    const put = store.runs.put.bind(store.runs);
    vi.spyOn(store.runs, 'put').mockImplementation((run) => {
      puts.push(structuredClone(run));
      return put(run);
    });
    return { store, puts, deps: changes({ ...deps, commit: '3c22f9b' }) };
  }

  it('opens the run as running with its start and commit, and closes it with its status', async () => {
    const { store, puts, deps } = await setup();
    const run = await runPipeline(deps);
    expect(puts[0]).toMatchObject({
      id: '2026-11-05T14-00-00Z-pipeline',
      kind: 'pipeline',
      status: 'running',
      startedAt: START,
      finishedAt: null,
      commit: '3c22f9b',
    });
    expect(puts).toHaveLength(2);
    // Boards with no saved copy answer 404, which the run notes, so it is partial.
    expect(run).toMatchObject({ status: 'partial', finishedAt: END, commit: '3c22f9b' });
    expect(await store.runs.get(runId(START))).toEqual(run);
  });

  it('notes each board that was skipped with its status, and carries on', async () => {
    const { deps } = await setup();
    const run = await runPipeline(deps);
    const skipped = run.errors.filter((error) => error.status === 404);
    expect(skipped.length).toBe(42);
    expect(skipped[0]).toMatchObject({
      step: 'collect',
      target: expect.stringMatching(/^(greenhouse|lever|ashby):/) as unknown,
    });
    expect(run.jobs.new).toBe(647);
  });

  it('keeps going when one source fails, and redacts any secret in its message', async () => {
    const { store, deps } = await setup((d) => ({
      ...d,
      secrets: [API_KEY],
      lists: (stored) => [...d.lists(stored), broken('extra', `401 with x-api-key ${API_KEY}`)],
    }));
    const run = await runPipeline(deps);
    expect(run.status).toBe('partial');
    const error = run.errors.find((e) => e.target === 'extra');
    expect(error).toMatchObject({ step: 'collect', status: null });
    expect(error?.message).toBe('401 with x-api-key [redacted]');
    expect(JSON.stringify(await store.runs.list())).not.toContain(API_KEY);
    expect(run.jobs.new).toBe(647);
  });

  it('keeps going when the triage call fails, and records it', async () => {
    const { store, deps } = await setup((d) => ({
      ...d,
      triager: () => ({ triage: () => Promise.reject(new Error('529 overloaded')) }),
    }));
    const run = await runPipeline(deps);
    expect(run.status).toBe('partial');
    expect(run.errors).toContainEqual(
      expect.objectContaining({ step: 'triage', target: null, message: '529 overloaded' }),
    );
    expect(await store.jobs.list()).toHaveLength(647);
  });

  it('fails without collecting anything when the configuration is bad', async () => {
    const { store, deps } = await setup();
    await store.profile.put(aProfile());
    vi.spyOn(store.profile, 'get').mockResolvedValue(null);
    const run = await runPipeline(deps);
    expect(run).toMatchObject({
      status: 'failed',
      finishedAt: END,
      errors: [
        {
          step: 'run',
          target: null,
          message: 'profile/main is missing: run `pnpm scout profile push` first',
        },
      ],
    });
    expect(board.requests).toEqual([]);
    expect((await store.runs.get(run.id))?.status).toBe('failed');
  });

  it('fails when Firestore stops answering in the middle', async () => {
    const { store, deps } = await setup();
    vi.spyOn(store.jobs, 'putMany').mockRejectedValue(
      new Error('14 UNAVAILABLE: connection refused'),
    );
    const run = await runPipeline(deps);
    expect(run.status).toBe('failed');
    expect(run.errors.at(-1)).toMatchObject({
      step: 'run',
      message: '14 UNAVAILABLE: connection refused',
    });
  });

  it('throws when Firestore cannot be reached to record the run at all', async () => {
    const { store, deps } = await setup();
    vi.spyOn(store.runs, 'put').mockRejectedValue(new Error('14 UNAVAILABLE'));
    await expect(runPipeline(deps)).rejects.toThrow('14 UNAVAILABLE');
    expect(board.requests).toEqual([]);
  });

  it('deletes runs older than 90 days at the start, and keeps the rest', async () => {
    const { store, deps } = await setup();
    const day = 24 * 60 * 60 * 1000;
    const at = (days: number) => new Date(START.getTime() - days * day);
    await store.runs.put(aRun({ id: 'old', startedAt: at(91), finishedAt: at(91) }));
    await store.runs.put(aRun({ id: 'recent', startedAt: at(89), finishedAt: at(89) }));
    await runPipeline(deps);
    expect((await store.runs.list()).map((run) => run.id).sort()).toEqual([runId(START), 'recent']);
  });
});
