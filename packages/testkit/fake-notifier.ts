import type { Notice, Notifier } from '@scout/core';
import { settle } from './settle';

/** The `Notifier` port, keeping every notice sent. `failing` makes every send throw. */
export class FakeNotifier implements Notifier {
  readonly sent: Notice[] = [];
  failing: Error | null = null;

  send(notice: Notice): Promise<void> {
    return settle(() => {
      if (this.failing) throw this.failing;
      this.sent.push(structuredClone(notice));
    });
  }
}
