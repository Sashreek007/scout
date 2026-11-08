// The daily workflow's last step, when anything before it failed (#13): tell the phone, unless the
// run got far enough to send its own digest, which already says it failed.
import type { Notifier, Store } from '@scout/core';

export interface NotifyFailureInput {
  store: Store;
  notifier: Notifier;
  /** When the workflow started. A run that started since then and sent its digest has reported. */
  since: Date;
  /** The GitHub Actions run, which the notification opens. */
  link: string;
}

/** Sends one short failure notice, and says whether it did. */
export async function notifyFailure(input: NotifyFailureInput): Promise<boolean> {
  const runs = await input.store.runs.list();
  const reported = runs.some(
    (run) => run.startedAt.getTime() >= input.since.getTime() && run.digest?.notified === true,
  );
  if (reported) return false;
  await input.notifier.send({
    kind: 'failure',
    title: 'The morning run failed before it could report',
    body: null,
    url: input.link,
  });
  return true;
}
