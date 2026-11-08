// Web push to the dashboard on his phone, through Firebase Cloud Messaging with the service account
// (#12, docs/architecture.md, section 5, "Notifier"). Tokens are never put in a message or a log.
import type { Notice, Notifier, Store } from '@scout/core';
import { getApps } from 'firebase-admin/app';
import {
  getMessaging,
  type BatchResponse,
  type FidMulticastMessage,
} from 'firebase-admin/messaging';

/** The one call scout makes to FCM. `getMessaging()` from firebase-admin has it. */
export interface PushMessaging {
  sendEachForMulticast(message: FidMulticastMessage): Promise<BatchResponse>;
}

export interface PushNotifierOptions {
  messaging: PushMessaging;
  devices: Store['devices'];
  /** Injected so tests don't wait. */
  sleep?: (ms: number) => Promise<void>;
  /** Tries after the first. 2 by default (#12). */
  retries?: number;
}

/**
 * FCM's messaging client for the Firebase app `connectFirestore` started, with the same service
 * account. Throws if no app has been started.
 */
export function firebaseMessaging(): PushMessaging {
  const app = getApps()[0];
  if (!app) throw new Error('Start Firebase with connectFirestore before sending notifications');
  return getMessaging(app);
}

/** FCM's answer for a device that will never work again: it is removed. */
const GONE = new Set([
  'registration-token-not-registered',
  'invalid-registration-token',
  'installation-id-not-registered',
]);
const isGone = (code: string | undefined) => GONE.has((code ?? '').replace(/^messaging\//, ''));

/**
 * Sends a notice to every registered device. A call that throws, or reaches no device for a reason
 * other than a stale token, is tried twice more, a few seconds apart, and then fails with a message
 * that names how many devices failed and why, never the tokens. Tokens FCM says are gone are removed.
 */
export class PushNotifier implements Notifier {
  readonly #options: Required<Omit<PushNotifierOptions, 'sleep'>> & {
    sleep: (ms: number) => Promise<void>;
  };

  constructor(options: PushNotifierOptions) {
    this.#options = {
      retries: 2,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      ...options,
    };
  }

  async send(notice: Notice): Promise<void> {
    const tokens = (await this.#options.devices.list()).map((device) => device.token);
    if (tokens.length === 0) return;
    const message: FidMulticastMessage = {
      // firebase-admin 14 sends to Firebase Installation IDs; registration tokens are deprecated.
      fids: tokens,
      notification: { title: notice.title, ...(notice.body === null ? {} : { body: notice.body }) },
      data: { kind: notice.kind, url: notice.url },
      // A web push link has to be https; a relative one is left to the service worker's data.url.
      ...(notice.url.startsWith('https://')
        ? { webpush: { fcmOptions: { link: notice.url } } }
        : {}),
    };

    let last = 'no attempt was made';
    for (let attempt = 0; attempt <= this.#options.retries; attempt += 1) {
      if (attempt > 0) await this.#options.sleep(2000 * attempt);
      try {
        const response = await this.#options.messaging.sendEachForMulticast(message);
        const gone = response.responses.flatMap((result, i) =>
          !result.success && isGone(result.error?.code) ? [tokens[i] ?? ''] : [],
        );
        await Promise.all(gone.map((token) => this.#options.devices.remove(token)));
        const reached = response.successCount;
        const failedOtherwise = response.failureCount - gone.length;
        if (reached > 0 || failedOtherwise === 0) return;
        const codes = [
          ...new Set(response.responses.map((result) => result.error?.code ?? 'unknown')),
        ];
        last = `FCM reached none of ${String(tokens.length)} devices (${codes.join(', ')})`;
      } catch (error) {
        const code = (error as { code?: unknown }).code;
        last = `FCM failed${typeof code === 'string' ? ` with ${code}` : ''}`;
      }
    }
    throw new Error(`${last}, after ${String(this.#options.retries + 1)} tries`);
  }
}
