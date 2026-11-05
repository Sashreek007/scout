import { z } from 'zod';
import { AnswerValueSchema, Sha256Schema, TimestampSchema } from './common';

/**
 * `memory/{questionKey}`: an answer he gave before. The ID is the SHA-256 of the normalized
 * question, so the same question always maps to one document (section 6).
 */
export const MemoryEntrySchema = z.strictObject({
  questionKey: Sha256Schema,
  question: z.string().min(1),
  answer: AnswerValueSchema,
  /** A fact about him, or a preference like "how did you hear about us". */
  kind: z.enum(['fact', 'preference']).default('fact'),
  /** Where the answer came from, like `answers.yaml` or the question it answered. */
  source: z.string().min(1),
  timesUsed: z.int().min(0).default(0),
  lastUsedAt: TimestampSchema.nullable().default(null),
});
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;

/**
 * One entry of `profile/answers.yaml`: the question, its answer and where it came from. The push
 * adds the question key, and keeps the use counts already in Firestore.
 */
export const MemorySeedSchema = MemoryEntrySchema.pick({
  question: true,
  answer: true,
  kind: true,
  source: true,
});
export type MemorySeed = z.infer<typeof MemorySeedSchema>;
