// Builders for valid documents. Each returns a parsed document with invented values; pass
// overrides for what a test cares about. Northwind Robotics is the made-up company from
// docs/architecture.md, section 7.
import {
  AgentConfigSchema,
  ApplicationSchema,
  JobSchema,
  MemoryEntrySchema,
  ProfileSchema,
  QuestionSchema,
  RunSchema,
  StageEventSchema,
  type AgentConfig,
  type Application,
  type Job,
  type MemoryEntry,
  type Profile,
  type Question,
  type Run,
  type StageEvent,
} from '@scout/core';

export const NOW = new Date('2026-11-05T14:00:00Z');

export function aJob(overrides: Partial<Job> = {}): Job {
  return JobSchema.parse({
    key: 'greenhouse:northwind:4100001',
    ats: 'greenhouse',
    boardToken: 'northwind',
    postingId: '4100001',
    company: 'Northwind Robotics',
    title: 'Software Developer Intern',
    locations: ['Toronto, ON, Canada'],
    rawTerm: 'Winter 2027',
    terms: ['Winter 2027'],
    applyUrl: 'https://job-boards.greenhouse.io/northwind/jobs/4100001',
    unresolvedUrl: false,
    postedAt: new Date('2026-11-01T00:00:00Z'),
    description: 'Build the services behind our warehouse robots, in Go and TypeScript.',
    sources: [{ name: 'greenhouse', url: null }],
    contentHash: 'a'.repeat(64),
    filter: { passed: true, reasons: [], flags: [] },
    triage: null,
    active: true,
    missedRuns: 0,
    firstSeenAt: NOW,
    lastSeenAt: NOW,
    ...overrides,
  });
}

export function anApplication(overrides: Partial<Application> = {}): Application {
  return ApplicationSchema.parse({
    jobKey: 'greenhouse:northwind:4100001',
    company: 'Northwind Robotics',
    title: 'Software Developer Intern',
    stage: 'queued',
    stageAt: NOW,
    form: null,
    sheet: null,
    lease: null,
    submitAttemptAt: null,
    submittedAt: null,
    confirmationText: null,
    notes: '',
    summary: null,
    createdAt: NOW,
    ...overrides,
  });
}

/** The event that creates an application in its first stage. */
export function aCreationEvent(app: Application, overrides: Partial<StageEvent> = {}): StageEvent {
  return StageEventSchema.parse({
    from: null,
    to: app.stage,
    by: 'pipeline',
    at: app.createdAt,
    detail: null,
    ...overrides,
  });
}

export function aQuestion(overrides: Partial<Question> = {}): Question {
  return QuestionSchema.parse({
    id: 'greenhouse:northwind:4100001:question_1003',
    jobKey: 'greenhouse:northwind:4100001',
    fieldId: 'question_1003',
    questionKey: 'b'.repeat(64),
    label: 'Are you available for in-person interviews in Toronto?',
    type: 'select',
    options: ['Yes', 'No'],
    company: 'Northwind Robotics',
    title: 'Software Developer Intern',
    status: 'open',
    suggestedAnswer: null,
    answer: null,
    remember: false,
    askedAt: NOW,
    answeredAt: null,
    worker: null,
    tabTitle: null,
    expiresAt: null,
    ...overrides,
  });
}

export function aMemoryEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return MemoryEntrySchema.parse({
    questionKey: 'c'.repeat(64),
    question: 'How did you hear about us?',
    answer: 'Company website',
    kind: 'preference',
    source: 'answers.yaml',
    ...overrides,
  });
}

export function aProfile(overrides: Partial<Profile> = {}): Profile {
  return ProfileSchema.parse({
    identity: {
      full_name: 'Alex Example',
      email: 'alex@example.com',
      phone: '+1 780 555 0100',
      city: 'Edmonton, AB, Canada',
      pronouns: null,
    },
    links: {
      linkedin: null,
      github: 'https://github.com/example',
      portfolio: 'https://example.com',
    },
    education: {
      school: 'Example University',
      degree: 'BSc Computing Science',
      year_of_study: 3,
      expected_graduation: 'April 2028',
      gpa: null,
    },
    work_authorization: {
      status: 'Study permit with a co-op work permit',
      citizenship: 'Exampleland',
      requires_sponsorship_for_coop: false,
      canadian_citizen_or_pr: false,
      internship_program: 'Example Internship Program',
      sip_registered: true,
      us_work_authorized: false,
    },
    availability: {
      earliest_start: 'January 2027',
      term_lengths_ok: [4, 8, 12],
      relocation: { edmonton: true, toronto: true, remote: true },
    },
    compensation: { expected_hourly_cad: null },
    current_role: null,
    resumes: {
      default: { path: '/tmp/scout-example/resume.pdf', sha256: 'd'.repeat(64) },
      backend: null,
      ai: null,
      devops: null,
    },
    demographics: { policy: 'decline_to_answer' },
    filters: {
      excluded_sectors: ['defence', 'weapons', 'surveillance'],
      excluded_employers: ['General Dynamics'],
      skip_if_requires: ['canadian_citizenship', 'permanent_residence', 'SWPP', 'FSWEP'],
      location: 'canada_only',
      target_roles: ['software engineering intern', 'co-op'],
      daily_cap: 20,
    },
    ...overrides,
  });
}

export function aRun(overrides: Partial<Run> = {}): Run {
  return RunSchema.parse({
    id: '2026-11-05T14-00-00Z-pipeline',
    kind: 'pipeline',
    status: 'ok',
    commit: null,
    startedAt: NOW,
    finishedAt: new Date('2026-11-05T14:04:00Z'),
    sources: {},
    filterReasons: {},
    triageDecisions: {},
    tokens: { input: 0, output: 0, cacheRead: 0 },
    costUsd: 0,
    errors: [],
    ...overrides,
  });
}

export function anAgentConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return AgentConfigSchema.parse(overrides);
}
