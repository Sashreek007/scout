import { z } from 'zod';
import { AnswerValueSchema, JobKeySchema, Sha256Schema, TimestampSchema } from './common';
import { FieldTypeSchema } from './form';

/**
 * `questions/{questionId}`: one question for one field of one application. Live questions from a
 * worker also carry the worker, its tab title and when the held form gives up (section 5).
 */
export const QuestionSchema = z
  .strictObject({
    id: z.string().min(1),
    jobKey: JobKeySchema,
    fieldId: z.string().min(1),
    /** SHA-256 of the normalized question, the same key `memory` uses. */
    questionKey: Sha256Schema,
    label: z.string().min(1),
    type: FieldTypeSchema,
    options: z.array(z.string()),
    company: z.string().min(1),
    title: z.string().min(1),
    status: z.enum(['open', 'answered']),
    suggestedAnswer: AnswerValueSchema.nullable(),
    answer: AnswerValueSchema.nullable(),
    /** Whether answering also writes `memory`, so no form asks again. */
    remember: z.boolean(),
    askedAt: TimestampSchema,
    answeredAt: TimestampSchema.nullable(),
    worker: z.int().min(1).max(8).nullable(),
    tabTitle: z.string().min(1).nullable(),
    expiresAt: TimestampSchema.nullable(),
  })
  .refine(
    (question) =>
      (question.status === 'answered') ===
      (question.answer !== null && question.answeredAt !== null),
    { message: 'an answered question has its answer and answeredAt, an open one has neither' },
  );
export type Question = z.infer<typeof QuestionSchema>;
