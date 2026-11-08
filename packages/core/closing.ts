// Closing an application when its posting is taken down (#10, docs/architecture.md, section 8).
// The pipeline notices when a posting stops being listed; a form reader or filler notices a 404 or
// a "no longer accepting applications" page. Either way the move goes through the stage machine.
import { StaleStageError } from './errors';
import type { Store } from './ports';
import type { JobKey, StageEvent } from './schemas';
import { canMove, type Actor } from './stages';

/** Pages that say a posting is gone even though they answer 200. */
const GONE_TEXT = [
  /no longer accepting applications/i,
  /(?:job|position|posting|role|requisition)(?: posting)? (?:is|has been) (?:closed|filled|removed|expired)/i,
  /(?:job|position|posting|role) (?:is )?no longer (?:available|open|active|accepting)/i,
  /this (?:job|posting|position) has expired/i,
];

/**
 * True when a form reader or filler sees that a posting is gone: the board answered 404 or 410,
 * or its page says the posting no longer takes applications.
 */
export function postingGone(response: { status: number | null; text?: string | null }): boolean {
  if (response.status === 404 || response.status === 410) return true;
  const text = response.text ?? '';
  return GONE_TEXT.some((pattern) => pattern.test(text));
}

/**
 * Moves the posting's application to `closed`, with its event, when its stage allows it for `by`:
 * the pipeline closes one from `queued` to `approved`, the agent one in `filling`. Anything later
 * is left alone, and so is an application someone moved meanwhile. Returns the event, or null
 * when nothing moved.
 */
export async function closeGonePosting(
  store: Store,
  jobKey: JobKey,
  move: { by: Actor; detail: string; at: Date },
): Promise<StageEvent | null> {
  const app = await store.applications.get(jobKey);
  if (!app || !canMove(app.stage, 'closed', move.by)) return null;
  try {
    const { event } = await store.moveStage(jobKey, { from: app.stage, to: 'closed', ...move });
    return event;
  } catch (error) {
    if (error instanceof StaleStageError) return null;
    throw error;
  }
}
