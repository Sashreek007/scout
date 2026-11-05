import { describe, expect, it } from 'vitest';
import { validProfile } from './examples.fixture';
import { isTodo, ProfileFileSchema, ProfileSchema } from './profile';

function issues(input: unknown) {
  const result = ProfileSchema.safeParse(input);
  return result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

describe('ProfileSchema', () => {
  it('parses a filled profile, keeping TODO in optional fields', () => {
    const profile = ProfileSchema.parse(validProfile);
    expect(profile.links.linkedin).toBe('TODO');
    expect(profile.compensation.expected_hourly_cad).toBe('TODO');
    expect(profile.demographics.answers).toEqual({});
  });

  it('reads yes and no as booleans, since YAML 1.2 leaves them as strings', () => {
    const profile = ProfileSchema.parse(validProfile);
    expect(profile.availability.relocation).toEqual({
      edmonton: true,
      toronto: 'TODO',
      remote: true,
    });
  });

  it('rejects TODO in a required field with "TODO is not allowed"', () => {
    const input = {
      ...validProfile,
      availability: { ...validProfile.availability, earliest_start: 'TODO' },
      work_authorization: { ...validProfile.work_authorization, sip_registered: 'TODO' },
    };
    expect(issues(input)).toEqual([
      'work_authorization.sip_registered: TODO is not allowed',
      'availability.earliest_start: TODO is not allowed',
    ]);
  });

  it('rejects a start date the planner could not read', () => {
    const input = {
      ...validProfile,
      availability: { ...validProfile.availability, earliest_start: 'Jan 2027' },
    };
    expect(issues(input)).toEqual([
      'availability.earliest_start: expected a month and year, like "January 2027"',
    ]);
  });

  it('rejects an unknown key, so a typo in profile.yaml is caught', () => {
    const input = { ...validProfile, identity: { ...validProfile.identity, fullname: 'x' } };
    expect(issues(input)).toEqual(['identity: Unrecognized key: "fullname"']);
  });

  it('defaults a missing optional field to null', () => {
    const { pronouns: _omitted, ...identity } = validProfile.identity;
    expect(ProfileSchema.parse({ ...validProfile, identity }).identity.pronouns).toBeNull();
  });
});

describe('isTodo', () => {
  it('matches TODO in any case and with spaces', () => {
    expect(isTodo('TODO')).toBe(true);
    expect(isTodo(' todo ')).toBe(true);
    expect(isTodo('To do the thing')).toBe(false);
    expect(isTodo(null)).toBe(false);
  });
});

describe('ProfileFileSchema', () => {
  const file = {
    ...validProfile,
    resumes: { default: 'resumes/default.pdf', backend: 'TODO', ai: null, devops: null },
  };

  it('takes each resume as a path, as profile.yaml has it', () => {
    expect(ProfileFileSchema.parse(file).resumes).toEqual({
      default: 'resumes/default.pdf',
      backend: 'TODO',
      ai: null,
      devops: null,
    });
  });

  it('still rejects TODO in a required field, and unknown keys', () => {
    const unfinished = { ...file, resumes: { ...file.resumes, default: 'TODO' } };
    expect(ProfileFileSchema.safeParse(unfinished).error?.issues[0]?.message).toBe(
      'TODO is not allowed',
    );
    expect(ProfileFileSchema.safeParse({ ...file, extra: 1 }).success).toBe(false);
  });
});
