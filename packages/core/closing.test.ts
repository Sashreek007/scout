import { InMemoryStore, aCreationEvent, anApplication } from '@scout/testkit';
import { describe, expect, it } from 'vitest';
import { closeGonePosting, postingGone } from './closing';
import type { Stage } from './stages';

const T0 = new Date('2026-11-05T14:00:00Z');
const AT = new Date('2026-11-08T14:00:00Z');
const KEY = 'greenhouse:northwind:4100001';

/** The moves that take a new application to each stage, a minute apart. */
const PATHS: Record<string, [Stage, Stage, 'pipeline' | 'you' | 'agent'][]> = {
  queued: [],
  planning: [['queued', 'planning', 'pipeline']],
  needs_answers: [
    ['queued', 'planning', 'pipeline'],
    ['planning', 'needs_answers', 'pipeline'],
  ],
  review: [
    ['queued', 'planning', 'pipeline'],
    ['planning', 'review', 'pipeline'],
  ],
  approved: [
    ['queued', 'planning', 'pipeline'],
    ['planning', 'review', 'pipeline'],
    ['review', 'approved', 'you'],
  ],
  filling: [
    ['queued', 'planning', 'pipeline'],
    ['planning', 'review', 'pipeline'],
    ['review', 'approved', 'you'],
    ['approved', 'filling', 'agent'],
  ],
  applied: [
    ['queued', 'planning', 'pipeline'],
    ['planning', 'review', 'pipeline'],
    ['review', 'approved', 'you'],
    ['approved', 'filling', 'agent'],
    ['filling', 'applied', 'agent'],
  ],
};

async function storeWith(stage: keyof typeof PATHS) {
  const store = new InMemoryStore();
  const app = anApplication({ jobKey: KEY, stage: 'queued', stageAt: T0, createdAt: T0 });
  await store.applications.create(app, aCreationEvent(app));
  for (const [i, [from, to, by]] of (PATHS[stage] ?? []).entries()) {
    await store.moveStage(KEY, { from, to, by, at: new Date(T0.getTime() + (i + 1) * 60_000) });
  }
  return store;
}

describe('postingGone', () => {
  it.each([
    [{ status: 404 }],
    [{ status: 410 }],
    [{ status: 200, text: 'Sorry, this job is no longer accepting applications.' }],
    [{ status: 200, text: 'The position has been filled.' }],
    [{ status: 200, text: 'This posting is no longer available' }],
    [{ status: 200, text: 'This job has expired.' }],
  ])('reads %j as gone', (response) => {
    expect(postingGone(response)).toBe(true);
  });

  it.each([
    [{ status: 200, text: 'Apply for Software Developer Intern' }],
    [{ status: 503 }],
    [{ status: null }],
    [{ status: 200, text: 'Applications close on November 30.' }],
  ])('does not read %j as gone', (response) => {
    expect(postingGone(response)).toBe(false);
  });
});

describe('closeGonePosting', () => {
  it.each(['queued', 'planning', 'needs_answers', 'review', 'approved'] as const)(
    'closes an application in %s, with an event by the pipeline',
    async (stage) => {
      const store = await storeWith(stage);
      const event = await closeGonePosting(store, KEY, { by: 'pipeline', detail: 'gone', at: AT });
      expect(event).toEqual({ from: stage, to: 'closed', by: 'pipeline', at: AT, detail: 'gone' });
      expect((await store.applications.get(KEY))?.stage).toBe('closed');
      expect((await store.applications.events(KEY)).at(-1)).toEqual(event);
    },
  );

  it.each(['filling', 'applied'] as const)('leaves an application in %s alone', async (stage) => {
    const store = await storeWith(stage);
    expect(
      await closeGonePosting(store, KEY, { by: 'pipeline', detail: 'gone', at: AT }),
    ).toBeNull();
    expect((await store.applications.get(KEY))?.stage).toBe(stage);
  });

  it('lets the agent close one it is filling when the page says the posting is gone', async () => {
    const store = await storeWith('filling');
    const event = await closeGonePosting(store, KEY, { by: 'agent', detail: '404', at: AT });
    expect(event).toMatchObject({ from: 'filling', to: 'closed', by: 'agent' });
  });

  it('does nothing for a job with no application', async () => {
    expect(
      await closeGonePosting(new InMemoryStore(), KEY, { by: 'pipeline', detail: 'gone', at: AT }),
    ).toBeNull();
  });

  it('never reopens a closed application', async () => {
    const store = await storeWith('review');
    await closeGonePosting(store, KEY, { by: 'pipeline', detail: 'gone', at: AT });
    expect(
      await closeGonePosting(store, KEY, { by: 'pipeline', detail: 'again', at: AT }),
    ).toBeNull();
    expect(await store.applications.events(KEY)).toHaveLength(4);
  });
});
