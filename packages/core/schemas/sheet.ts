import { z } from 'zod';
import { AnswerValueSchema, TimestampSchema } from './common';

/**
 * Where an answer came from (#16). Factual answers always cite their evidence: a profile path,
 * a memory key or a policy name.
 */
export const AnswerSourceSchema = z.enum([
  'profile',
  'memory',
  'policy',
  'claude_fact',
  'claude_draft',
  'you',
]);
export type AnswerSource = z.infer<typeof AnswerSourceSchema>;

const NEEDS_EVIDENCE: readonly AnswerSource[] = ['profile', 'memory', 'policy', 'claude_fact'];

export const SheetAnswerSchema = z
  .strictObject({
    fieldId: z.string().min(1),
    value: AnswerValueSchema,
    source: AnswerSourceSchema,
    evidence: z.string().min(1).nullable(),
    /** Drafts and anything else he must read before approving. */
    needsReview: z.boolean(),
    approved: z.boolean(),
  })
  .refine((answer) => !NEEDS_EVIDENCE.includes(answer.source) || answer.evidence !== null, {
    message: 'a factual answer must cite its evidence',
    path: ['evidence'],
  })
  .refine((answer) => answer.source !== 'claude_draft' || answer.needsReview, {
    message: 'a drafted answer always needs his review',
    path: ['needsReview'],
  });
export type SheetAnswer = z.infer<typeof SheetAnswerSchema>;

/** The answer sheet he approves. The agent fills only from this. */
export const SheetSchema = z
  .strictObject({
    answers: z.array(SheetAnswerSchema),
    updatedAt: TimestampSchema,
    approvedAt: TimestampSchema.nullable(),
  })
  .refine(
    (sheet) => new Set(sheet.answers.map((answer) => answer.fieldId)).size === sheet.answers.length,
    { message: 'each field has at most one answer', path: ['answers'] },
  );
export type Sheet = z.infer<typeof SheetSchema>;
