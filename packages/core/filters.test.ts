import { describe, expect, it } from 'vitest';
import { filterJob, termStart, wantsTerm, type FilterInput } from './filters';
import { validProfile } from './schemas/examples.fixture';
import { ProfileSchema, type Profile } from './schemas';

const profile: Profile = ProfileSchema.parse({
  ...validProfile,
  availability: { ...validProfile.availability, earliest_start: 'January 2027' },
  filters: {
    ...validProfile.filters,
    skip_if_requires: ['canadian_citizenship', 'permanent_residence', 'SWPP', 'FSWEP'],
    terms: ['Winter 2027', 'Summer 2027', 'Fall 2027'],
  },
});

const job = (overrides: Partial<FilterInput['job']> = {}): FilterInput['job'] => ({
  company: 'Northwind Robotics',
  title: 'Software Developer Intern',
  locations: ['Toronto, ON, Canada'],
  terms: ['Winter 2027'],
  description: 'Build the services behind our warehouse robots, in Go and TypeScript.',
  ...overrides,
});

const check = (overrides: Partial<FilterInput['job']> = {}, more: Partial<FilterInput> = {}) =>
  filterJob({ job: job(overrides), profile, applicationStage: null, ...more });

describe('filterJob', () => {
  it('passes a Canadian software internship in a wanted term with no reasons', () => {
    expect(check()).toEqual({ passed: true, reasons: [], flags: [], details: {} });
  });

  it('runs every rule in order and keeps every reason', () => {
    const result = check(
      {
        company: 'General Dynamics UK',
        title: 'Mechanical Engineering Intern',
        locations: ['Stockholm, Sweden'],
        terms: ['Summer 2026'],
        description: 'Applicants must be Canadian citizens.',
      },
      { applicationStage: 'applied' },
    );
    expect(result.passed).toBe(false);
    expect(result.reasons).toEqual([
      'location',
      'role',
      'term',
      'values',
      'eligibility',
      'already_applied',
    ]);
    expect(Object.keys(result.details)).toEqual(result.reasons);
  });
});

describe('location', () => {
  it.each([[['Markham, ON, Canada']], [['Remote in Canada']], [['New York, NY', 'Toronto, ON']]])(
    'passes %j',
    (locations) => {
      expect(check({ locations }).reasons).not.toContain('location');
    },
  );

  it.each([[['Remote in USA']], [['Stockholm, Sweden']], [[]]])('fails %j', (locations) => {
    const result = check({ locations });
    expect(result.reasons).toContain('location');
    expect(result.details.location).toBe(
      locations.length === 0 ? 'no location given' : `not in Canada: ${locations.join('; ')}`,
    );
  });
});

describe('role', () => {
  it.each([
    'Software Developer Intern',
    'AI/ML Engineer Co-op',
    'DevOps Intern',
    'Back-End Developer Co-op',
    'Data Engineering Co-op',
    'Linux Intern',
    'eReader Quality Assurance Intern',
  ])('passes "%s"', (title) => {
    expect(check({ title }).reasons).not.toContain('role');
  });

  it.each([
    ['Hardware Design Engineer Intern', 'hardware'],
    ['Analog/Mixed-Signal IC Design Co-op', 'analog'],
    ['Mechanical Engineering Intern', 'mechanical'],
    ['Sales Development Co-op', 'sales'],
    ['Product Marketing Intern', 'marketing'],
  ])('fails "%s" for "%s" by default', (title, word) => {
    const result = check({ title });
    expect(result.reasons).toContain('role');
    expect(result.details.role).toBe(`title says "${word}"`);
  });

  it('fails a title that names none of the target keywords', () => {
    const result = check({ title: 'Product Management Intern' });
    expect(result.reasons).toContain('role');
    expect(result.details.role).toBe('title names none of the target roles');
  });

  it('takes both lists from profile.filters', () => {
    const mine = ProfileSchema.parse({
      ...profile,
      filters: {
        ...profile.filters,
        role_keywords: ['product'],
        excluded_role_keywords: ['software'],
      },
    });
    const run = (title: string) =>
      filterJob({ job: job({ title }), profile: mine, applicationStage: null }).reasons;
    expect(run('Product Management Intern')).not.toContain('role');
    expect(run('Software Developer Intern')).toContain('role');
  });
});

describe('term', () => {
  it('passes a job with a term the profile lists', () => {
    expect(check({ terms: ['Fall 2027', 'Winter 2028'] }).reasons).not.toContain('term');
  });

  it('fails a job whose terms the profile does not list', () => {
    const result = check({ terms: ['Summer 2026', 'Fall 2026'] });
    expect(result.reasons).toContain('term');
    expect(result.details.term).toBe('Summer 2026, Fall 2026 not wanted');
  });

  it('passes a job with no known term, flagged term_unknown', () => {
    const result = check({ terms: [] });
    expect(result).toMatchObject({ passed: true, flags: ['term_unknown'] });
  });

  it('without a term list, wants every term that starts on or after his earliest start', () => {
    const open = ProfileSchema.parse({ ...profile, filters: { ...profile.filters, terms: [] } });
    expect(
      ['Fall 2026', 'Winter 2027', 'Summer 2027', 'Winter 2030'].map((t) => wantsTerm(open, t)),
    ).toEqual([false, true, true, true]);
  });

  it('reads a term as the month it starts in', () => {
    expect(['Winter 2027', 'Spring 2027', 'Summer 2027', 'Fall 2027'].map(termStart)).toEqual([
      '2027-01',
      '2027-05',
      '2027-05',
      '2027-09',
    ]);
  });
});

describe('values', () => {
  it.each([
    'General Dynamics',
    'general dynamics',
    'General Dynamics UK',
    'GENERAL DYNAMICS Mission Systems-Canada',
  ])('fails %s', (company) => {
    const result = check({ company });
    expect(result.reasons).toContain('values');
    expect(result.details.values).toBe('General Dynamics is on the excluded employers');
  });

  it('matches whole words only', () => {
    expect(check({ company: 'Generally Dynamic Inc' }).reasons).not.toContain('values');
  });

  it('only flags defence, weapons or military words, so he decides on dual-use employers', () => {
    for (const description of [
      'We build sensors for defence and aerospace customers.',
      'Our customers include the US Department of Defense.',
      'Experience with weapons systems is an asset.',
      'Military veterans are encouraged to apply.',
    ]) {
      const result = check({ description });
      expect(result).toMatchObject({ passed: true, flags: ['values_review'] });
    }
    expect(check({ title: 'Defence Systems Software Intern', description: null }).flags).toEqual([
      'values_review',
    ]);
  });
});

describe('eligibility', () => {
  it.each([
    ['Applicants must be Canadian citizens.', 'Canadian citizen'],
    [
      'Canadian citizenship and eligibility for security clearance (required for this role).',
      'Canadian citizen',
    ],
    ['You must be a permanent resident of Canada.', 'permanent resident'],
    ['Open to protected persons only.', 'protected person'],
    ['This position is funded through SWPP.', 'SWPP'],
    ['Funded by the Student Work Placement Program.', 'Student Work Placement'],
    ['Hired through FSWEP.', 'FSWEP'],
  ])('fails "%s"', (description, phrase) => {
    const result = check({ description });
    expect(result.reasons).toContain('eligibility');
    expect(result.details.eligibility).toBe(`says "${phrase}"`);
  });

  it('only flags a clause that also lets a work permit in, because his co-op permit counts', () => {
    const result = check({
      description:
        'You must be legally entitled to work in Canada as a citizen, permanent resident or holder of a valid work permit.',
    });
    expect(result).toMatchObject({ passed: true, flags: ['eligibility_review'] });
    expect(result.details.eligibility_review).toBe(
      'says "permanent resident", next to a work permit or visa',
    );
  });

  it('flags security clearance and Controlled Goods instead of failing', () => {
    expect(check({ description: 'Requires Reliability Status security clearance.' }).flags).toEqual(
      ['clearance'],
    );
    expect(check({ description: 'Registered under the Controlled Goods Program.' }).flags).toEqual([
      'clearance',
    ]);
  });

  it('follows skip_if_requires, so a requirement he no longer minds can be taken off', () => {
    const mine = ProfileSchema.parse({
      ...profile,
      filters: { ...profile.filters, skip_if_requires: ['SWPP', 'FSWEP'] },
    });
    const result = filterJob({
      job: job({ description: 'Applicants must be Canadian citizens.' }),
      profile: mine,
      applicationStage: null,
    });
    expect(result.reasons).not.toContain('eligibility');
  });

  it('ignores the citizen and PR rules once his profile says he is one', () => {
    const citizen = ProfileSchema.parse({
      ...profile,
      work_authorization: { ...profile.work_authorization, canadian_citizen_or_pr: true },
    });
    const result = filterJob({
      job: job({ description: 'Applicants must be Canadian citizens.' }),
      profile: citizen,
      applicationStage: null,
    });
    expect(result.reasons).not.toContain('eligibility');
  });

  it('does not read "citizen" on its own as a requirement', () => {
    const description =
      'We value diversity regardless of race, citizenship or age, and better citizen outcomes.';
    expect(check({ description }).reasons).not.toContain('eligibility');
  });
});

describe('already applied', () => {
  it.each(['approved', 'filling', 'needs_hand', 'applied', 'interview', 'rejected'] as const)(
    'fails a job whose application is in %s',
    (stage) => {
      const result = check({}, { applicationStage: stage });
      expect(result.reasons).toEqual(['already_applied']);
      expect(result.details.already_applied).toBe(`application is ${stage}`);
    },
  );

  it.each(['queued', 'planning', 'needs_answers', 'review', 'skipped', 'closed'] as const)(
    'passes a job whose application is in %s',
    (stage) => {
      expect(check({}, { applicationStage: stage }).reasons).toEqual([]);
    },
  );
});
