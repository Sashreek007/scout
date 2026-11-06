import { describe, expect, it } from 'vitest';
import { validField as field, validForm } from './examples.fixture';
import { FormFieldSchema, FormSpecSchema } from './form';

describe('FormFieldSchema', () => {
  it('parses a select field with its options', () => {
    expect(FormFieldSchema.parse(field).options).toEqual(['Yes', 'No']);
  });

  it('rejects a select field with no options', () => {
    expect(FormFieldSchema.safeParse({ ...field, options: [] }).success).toBe(false);
  });

  it('rejects an unknown field type', () => {
    expect(FormFieldSchema.safeParse({ ...field, type: 'dropdown' }).success).toBe(false);
  });
});

describe('FormSpecSchema', () => {
  it('parses a form', () => {
    expect(FormSpecSchema.parse(validForm).fields).toHaveLength(3);
  });

  it('rejects two fields with the same ID', () => {
    const fields = [validForm.fields[1], validForm.fields[1]];
    expect(FormSpecSchema.safeParse({ ...validForm, fields }).success).toBe(false);
  });
});
