import type { Job, Llm, Triage } from '@scout/core';
import {
  FakeLlm,
  InMemoryStore,
  aJob,
  aProfile,
  anAgentConfig,
  anApplication,
  aCreationEvent,
} from '@scout/testkit';
import { describe, expect, it } from 'vitest';
import { triageJobs } from './triage';

const NOW = new Date('2026-11-07T14:00:00Z');
const passed = { passed: true, reasons: [], flags: [], details: {} };
const job = (key: string, overrides: Partial<Job> = {}) =>
  aJob({
    key,
    filter: passed,
    triage: null,
    postedAt: new Date('2026-11-01T00:00:00Z'),
    ...overrides,
  });
const triage = (decision: Triage['decision'], score: number): Triage => ({
  decision,
  score,
  reasons: ['A reason'],
  lead: 'backend',
  flags: [],
});

async function step(
  jobs: Job[],
  llm: Pick<Llm, 'triage'>,
  store = new InMemoryStore(),
  agent = anAgentConfig(),
) {
  const result = await triageJobs({
    store,
    triager: llm,
    jobs,
    firstRun: false,
    profile: aProfile(),
    agent,
    now: NOW,
  });
  return { result, store };
}

describe('triageJobs', () => {
  it('triages the jobs that passed the filters and have none, and counts the decisions', async () => {
    const llm = new FakeLlm({ triage: { 'a:1': triage('maybe', 60), 'a:2': triage('skip', 10) } });
    const { result } = await step(
      [
        job('a:1'),
        job('a:2'),
        job('a:3', { filter: { ...passed, passed: false, reasons: ['role'] } }),
        job('a:4', { triage: triage('apply', 90) }),
      ],
      llm,
    );
    expect(llm.calls.map((call) => call.jobKey)).toEqual(['a:1', 'a:2']);
    expect(result.jobs.map((j) => [j.key, j.triage?.decision])).toEqual([
      ['a:1', 'maybe'],
      ['a:2', 'skip'],
    ]);
    expect(result.decisions).toEqual({ maybe: 1, skip: 1 });
  });

  it('queues an apply at or above autoQueueScore, with its first event by pipeline', async () => {
    const llm = new FakeLlm({
      triage: {
        'a:80': triage('apply', 80),
        'a:79': triage('apply', 79),
        'a:95': triage('maybe', 95),
      },
    });
    const { result, store } = await step([job('a:80'), job('a:79'), job('a:95')], llm);
    expect(result.queued).toEqual(['a:80']);
    expect(await store.applications.get('a:80')).toMatchObject({ stage: 'queued', createdAt: NOW });
    expect(await store.applications.events('a:80')).toEqual([
      { from: null, to: 'queued', by: 'pipeline', at: NOW, detail: 'triage scored 80' },
    ]);
    expect(await store.applications.get('a:79')).toBeNull();
    expect(await store.applications.get('a:95')).toBeNull();
  });

  it('uses the autoQueueScore from config/agent', async () => {
    const llm = new FakeLlm({ triage: { 'a:1': triage('apply', 85) } });
    const { result } = await step(
      [job('a:1')],
      llm,
      new InMemoryStore(),
      anAgentConfig({ autoQueueScore: 90 }),
    );
    expect(result.queued).toEqual([]);
  });

  it('leaves an application that already exists alone', async () => {
    const store = new InMemoryStore();
    const app = anApplication({ jobKey: 'a:1', stage: 'queued' });
    await store.applications.create(app, aCreationEvent(app, { by: 'you' }));
    const { result } = await step(
      [job('a:1')],
      new FakeLlm({ triage: { 'a:1': triage('apply', 99) } }),
      store,
    );
    expect(result.queued).toEqual([]);
    expect(await store.applications.events('a:1')).toHaveLength(1);
  });

  it('leaves a refused job untriaged and logs the reason', async () => {
    const llm = new FakeLlm({
      triage: { 'a:1': { refused: 'claude-sonnet-5-5 refused: cyber' }, 'a:2': triage('skip', 5) },
    });
    const { result } = await step([job('a:1'), job('a:2')], llm);
    expect(result.jobs.map((j) => j.key)).toEqual(['a:2']);
    expect(result.errors).toEqual([
      { step: 'triage', target: 'a:1', message: 'claude-sonnet-5-5 refused: cyber', at: NOW },
    ]);
  });

  it('logs a call that failed outright and triages nothing', async () => {
    const broken: Pick<Llm, 'triage'> = {
      triage: () => Promise.reject(new Error('529 overloaded')),
    };
    const { result } = await step([job('a:1')], broken);
    expect(result).toMatchObject({
      jobs: [],
      queued: [],
      errors: [{ step: 'triage', target: null, message: '529 overloaded' }],
    });
  });

  it('sends at most maxTriagePerRun jobs', async () => {
    const jobs = Array.from({ length: 5 }, (_, i) => job(`a:${String(i)}`));
    const llm = new FakeLlm({
      triage: Object.fromEntries(jobs.map((j) => [j.key, triage('skip', 1)])),
    });
    await step(jobs, llm, new InMemoryStore(), anAgentConfig({ maxTriagePerRun: 2 }));
    expect(llm.calls).toHaveLength(2);
  });

  it('makes no call at all when nothing needs triage', async () => {
    const llm = new FakeLlm();
    const { result } = await step([], llm);
    expect(llm.calls).toEqual([]);
    expect(result.costUsd).toBe(0);
  });
});
