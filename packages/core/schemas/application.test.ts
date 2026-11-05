import { describe, expect, it } from 'vitest';
import { ApplicationSchema } from './application';
import { validApplication } from './examples.fixture';

describe('ApplicationSchema', () => {
  it('parses an application in review with its form and sheet', () => {
    const app = ApplicationSchema.parse(validApplication);
    expect(app.stage).toBe('review');
    expect(app.form?.fields).toHaveLength(3);
  });

  it('parses a fresh application with no form or sheet yet', () => {
    const queued = { ...validApplication, stage: 'queued', form: null, sheet: null };
    expect(ApplicationSchema.safeParse(queued).success).toBe(true);
  });

  it('rejects an unknown stage', () => {
    expect(ApplicationSchema.safeParse({ ...validApplication, stage: 'submitted' }).success).toBe(
      false,
    );
  });

  it('rejects a lease without an expiry', () => {
    const leased = { ...validApplication, lease: { owner: 'mac:4821' } };
    expect(ApplicationSchema.safeParse(leased).success).toBe(false);
  });

  it('caps the saved confirmation text at 500 characters', () => {
    const long = { ...validApplication, confirmationText: 'x'.repeat(501) };
    expect(ApplicationSchema.safeParse(long).success).toBe(false);
  });
});
