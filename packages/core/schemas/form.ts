import { z } from 'zod';
import { AtsSchema, TimestampSchema } from './common';

export const FieldTypeSchema = z.enum([
  'text',
  'textarea',
  'file',
  'select',
  'multiselect',
  'radio',
  'checkbox',
  'date',
  'unknown',
]);
export type FieldType = z.infer<typeof FieldTypeSchema>;

const CHOICE_TYPES: readonly FieldType[] = ['select', 'multiselect', 'radio'];

/** One field on an application form, the same shape whichever reader found it (section 5). */
export const FormFieldSchema = z
  .strictObject({
    /** The board's own field name, like Greenhouse's `question_12345`. */
    id: z.string().min(1),
    label: z.string(),
    type: FieldTypeSchema,
    required: z.boolean(),
    options: z.array(z.string()),
    /** Voluntary demographic and compliance questions follow the profile's policy. */
    voluntary: z.boolean(),
    maxLength: z.int().positive().nullable(),
  })
  .refine((field) => !CHOICE_TYPES.includes(field.type) || field.options.length > 0, {
    message: 'a choice field needs at least one option',
    path: ['options'],
  });
export type FormField = z.infer<typeof FormFieldSchema>;

/** Every field on one application form, read before any browser opens where the board allows. */
export const FormSpecSchema = z
  .strictObject({
    board: AtsSchema,
    url: z.url(),
    readAt: TimestampSchema,
    fields: z.array(FormFieldSchema),
  })
  .refine((spec) => new Set(spec.fields.map((field) => field.id)).size === spec.fields.length, {
    message: 'field IDs must be unique',
    path: ['fields'],
  });
export type FormSpec = z.infer<typeof FormSpecSchema>;
