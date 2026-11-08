import { FakeNotifier, InMemoryStore, aRun } from '@scout/testkit';
import { describe, expect, it } from 'vitest';
import { notifyFailure } from './notify-failure';

const SINCE = new Date('2026-11-07T14:00:05Z');
const LINK = 'https://github.com/Sashreek007/scout/actions/runs/1';
const digest = (notified: boolean) => ({
  title: 'No new matches, the run failed',
  matches: 0,
  lines: [],
  questions: 0,
  sheets: 0,
  failures: ['the run'],
  notified,
});

describe('notifyFailure', () => {
  it('sends one short failure notice that opens the workflow run', async () => {
    const store = new InMemoryStore();
    const notifier = new FakeNotifier();
    expect(await notifyFailure({ store, notifier, since: SINCE, link: LINK })).toBe(true);
    expect(notifier.sent).toEqual([
      {
        kind: 'failure',
        title: 'The morning run failed before it could report',
        body: null,
        url: LINK,
      },
    ]);
  });

  it('stays quiet when this run already sent its own digest', async () => {
    const store = new InMemoryStore();
    await store.runs.put(
      aRun({ startedAt: new Date('2026-11-07T14:00:30Z'), status: 'failed', digest: digest(true) }),
    );
    const notifier = new FakeNotifier();
    expect(await notifyFailure({ store, notifier, since: SINCE, link: LINK })).toBe(false);
    expect(notifier.sent).toEqual([]);
  });

  it('still sends when the run started but its digest never went out, or the digest is from yesterday', async () => {
    const store = new InMemoryStore();
    await store.runs.put(
      aRun({
        id: 'today',
        startedAt: new Date('2026-11-07T14:00:30Z'),
        status: 'failed',
        digest: digest(false),
      }),
    );
    await store.runs.put(
      aRun({ id: 'yesterday', startedAt: new Date('2026-11-06T14:00:30Z'), digest: digest(true) }),
    );
    const notifier = new FakeNotifier();
    expect(await notifyFailure({ store, notifier, since: SINCE, link: LINK })).toBe(true);
  });
});
