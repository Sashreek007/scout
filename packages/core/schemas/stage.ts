import { z } from 'zod';
import { ACTORS, STAGES } from '../stages';
import { TimestampSchema } from './common';

/** Every stage an application can be in. The list and the allowed moves live in `stages.ts`. */
export const StageSchema = z.enum(STAGES);
export type Stage = z.infer<typeof StageSchema>;

/** Who moved an application: the daily pipeline, the agent on the Mac, Sashreek, or the mail watcher. */
export const ActorSchema = z.enum(ACTORS);
export type Actor = z.infer<typeof ActorSchema>;

/**
 * One move, stored append-only at `applications/{jobKey}/events/{eventId}`. `from` is null only for
 * the event that creates the application.
 */
export const StageEventSchema = z.strictObject({
  from: StageSchema.nullable(),
  to: StageSchema,
  by: ActorSchema,
  at: TimestampSchema,
  detail: z.string().max(2000).nullable(),
});
export type StageEvent = z.infer<typeof StageEventSchema>;
