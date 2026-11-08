import type { Notice } from '@scout/core';
import { InMemoryStore } from '@scout/testkit';
import type { BatchResponse, FidMulticastMessage } from 'firebase-admin/messaging';
import { describe, expect, it } from 'vitest';
import { PushNotifier, type PushMessaging } from './push-notifier';

// Made-up tokens shaped like FCM's.
const PHONE = `phone:APA91b${'p'.repeat(140)}`;
const LAPTOP = `laptop:APA91b${'l'.repeat(140)}`;
const AT = new Date('2026-11-07T14:00:00Z');

const notice: Notice = {
  kind: 'digest',
  title: '9 new matches, 4 questions waiting',
  body: null,
  url: 'https://scout.example.app/today',
};

/** A stand-in for FCM that answers each send from a script, and keeps every message. */
class FakeMessaging implements PushMessaging {
  readonly sent: FidMulticastMessage[] = [];
  constructor(private readonly answers: ((tokens: string[]) => BatchResponse | Error)[]) {}

  sendEachForMulticast(message: FidMulticastMessage): Promise<BatchResponse> {
    this.sent.push(message);
    const answer = (this.answers.shift() ?? ok)(message.fids);
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  }
}

const ok = (tokens: string[]): BatchResponse => ({
  successCount: tokens.length,
  failureCount: 0,
  responses: tokens.map(() => ({ success: true, messageId: 'm' })),
});
const failAll =
  (code: string) =>
  (tokens: string[]): BatchResponse => ({
    successCount: 0,
    failureCount: tokens.length,
    responses: tokens.map(() => ({
      success: false,
      error: { code, message: `boom for ${tokens.join(',')}` } as never,
    })),
  });

async function setup(answers: ConstructorParameters<typeof FakeMessaging>[0]) {
  const store = new InMemoryStore();
  await store.devices.put({ token: PHONE, label: 'iPhone', addedAt: AT });
  await store.devices.put({ token: LAPTOP, label: null, addedAt: AT });
  const messaging = new FakeMessaging(answers);
  const waits: number[] = [];
  const notifier = new PushNotifier({
    messaging,
    devices: store.devices,
    sleep: (ms) => {
      waits.push(ms);
      return Promise.resolve();
    },
  });
  return { store, messaging, notifier, waits };
}

describe('PushNotifier', () => {
  it('sends one web push to every device, opening the page in the notice', async () => {
    const { messaging, notifier } = await setup([ok]);
    await notifier.send(notice);
    expect(messaging.sent).toEqual([
      {
        fids: [PHONE, LAPTOP],
        notification: { title: '9 new matches, 4 questions waiting' },
        data: { kind: 'digest', url: 'https://scout.example.app/today' },
        webpush: { fcmOptions: { link: 'https://scout.example.app/today' } },
      },
    ]);
  });

  it('sends nothing when no device is registered', async () => {
    const messaging = new FakeMessaging([]);
    await new PushNotifier({ messaging, devices: new InMemoryStore().devices }).send(notice);
    expect(messaging.sent).toEqual([]);
  });

  it('tries twice more when a send fails, then succeeds', async () => {
    const { messaging, notifier, waits } = await setup([
      () => new Error('socket hang up'),
      failAll('messaging/internal-error'),
      ok,
    ]);
    await notifier.send(notice);
    expect(messaging.sent).toHaveLength(3);
    expect(waits).toEqual([2000, 4000]);
  });

  it('gives up after three tries, with a message that never names a token', async () => {
    const { messaging, notifier } = await setup([
      failAll('messaging/internal-error'),
      failAll('messaging/internal-error'),
      failAll('messaging/internal-error'),
    ]);
    const error = await notifier.send(notice).catch((e: unknown) => e as Error);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      'FCM reached none of 2 devices (messaging/internal-error), after 3 tries',
    );
    expect((error as Error).message).not.toContain('APA91b');
    expect(messaging.sent).toHaveLength(3);
  });

  it('removes a device FCM says is gone, and counts the send as done', async () => {
    const { store, notifier, messaging } = await setup([
      (tokens) => ({
        successCount: 1,
        failureCount: 1,
        responses: tokens.map((token) =>
          token === PHONE
            ? {
                success: false,
                error: { code: 'messaging/installation-id-not-registered' } as never,
              }
            : { success: true, messageId: 'm' },
        ),
      }),
    ]);
    await notifier.send(notice);
    expect((await store.devices.list()).map((d) => d.token)).toEqual([LAPTOP]);
    expect(messaging.sent).toHaveLength(1);
  });

  it('leaves out the link when the dashboard address is not https yet', async () => {
    const { messaging, notifier } = await setup([ok]);
    await notifier.send({ ...notice, url: '/today' });
    expect(messaging.sent[0]).not.toHaveProperty('webpush');
    expect(messaging.sent[0]?.data).toEqual({ kind: 'digest', url: '/today' });
  });
});
