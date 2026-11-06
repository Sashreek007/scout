// Valid examples of each document, shared by the schema tests. Northwind Robotics is the made-up
// company from docs/architecture.md, section 7. Every value here is invented.

export const validJob = {
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
  postedAt: null,
  description: 'Build the services behind our warehouse robots.',
  sources: [
    { name: 'simplify', url: null },
    { name: 'greenhouse', url: null },
  ],
  contentHash: 'c'.repeat(64),
  filter: { passed: true, reasons: [], flags: [] },
  triage: {
    decision: 'apply',
    score: 82,
    reasons: ['Backend role in Toronto that matches mint'],
    lead: 'backend',
    flags: [],
  },
  active: true,
  missedRuns: 0,
  firstSeenAt: new Date('2026-11-05T14:00:00Z'),
  lastSeenAt: new Date('2026-11-05T14:00:00Z'),
} as const;

export const validField = {
  id: 'question_1001',
  label: 'Are you legally eligible to work in Canada?',
  type: 'select',
  required: true,
  options: ['Yes', 'No'],
  voluntary: false,
  maxLength: null,
} as const;

export const validForm = {
  board: 'greenhouse',
  url: 'https://job-boards.greenhouse.io/northwind/jobs/4100001',
  readAt: new Date('2026-11-05T14:05:00Z'),
  fields: [
    { ...validField, id: 'first_name', label: 'First Name', type: 'text', options: [] },
    validField,
    {
      ...validField,
      id: 'question_1002',
      label: 'Why Northwind?',
      type: 'textarea',
      required: false,
      options: [],
      maxLength: 1000,
    },
  ],
} as const;

export const profileAnswer = {
  fieldId: 'question_1001',
  value: 'Yes',
  source: 'profile',
  evidence: 'work_authorization.status',
  needsReview: false,
  approved: false,
} as const;

export const draftAnswer = {
  fieldId: 'question_1002',
  value: 'Northwind builds the robots I would want to debug.',
  source: 'claude_draft',
  evidence: null,
  needsReview: true,
  approved: false,
} as const;

export const validSheet = {
  answers: [profileAnswer, draftAnswer],
  updatedAt: new Date('2026-11-05T14:06:00Z'),
  approvedAt: null,
} as const;

export const validApplication = {
  jobKey: 'greenhouse:northwind:4100001',
  company: 'Northwind Robotics',
  title: 'Software Developer Intern',
  stage: 'review',
  stageAt: new Date('2026-11-05T14:06:00Z'),
  form: validForm,
  sheet: validSheet,
  lease: null,
  submitAttemptAt: null,
  submittedAt: null,
  confirmationText: null,
  notes: '',
  summary: null,
  createdAt: new Date('2026-11-05T14:01:00Z'),
} as const;

export const openQuestion = {
  id: 'greenhouse:northwind:4100001:question_1003',
  jobKey: 'greenhouse:northwind:4100001',
  fieldId: 'question_1003',
  questionKey: 'd'.repeat(64),
  label: 'Are you available for in-person interviews in Toronto?',
  type: 'select',
  options: ['Yes', 'No'],
  company: 'Northwind Robotics',
  title: 'Software Developer Intern',
  status: 'open',
  suggestedAnswer: null,
  answer: null,
  remember: false,
  askedAt: new Date('2026-11-05T14:06:00Z'),
  answeredAt: null,
  worker: null,
  tabTitle: null,
  expiresAt: null,
} as const;

export const validMemory = {
  questionKey: 'e'.repeat(64),
  question: 'How did you hear about us?',
  answer: 'Company website',
  kind: 'preference',
  source: 'answers.yaml',
  timesUsed: 3,
  lastUsedAt: new Date('2026-11-04T18:00:00Z'),
} as const;

export const validProfile = {
  identity: {
    full_name: 'Alex Example',
    email: 'alex@example.com',
    phone: '+1 780 555 0100',
    city: 'Edmonton, AB, Canada',
    pronouns: null,
  },
  links: {
    linkedin: 'TODO',
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
    relocation: { edmonton: 'yes', toronto: 'TODO', remote: true },
  },
  compensation: { expected_hourly_cad: 'TODO' },
  current_role: { company: 'Example Co', title: 'Developer', start: 'Sep. 2025' },
  resumes: {
    default: { path: '/Users/example/resumes/default.pdf', sha256: 'f'.repeat(64) },
    backend: null,
    ai: null,
    devops: null,
  },
  demographics: { policy: 'decline_to_answer' },
  filters: {
    excluded_sectors: ['defence'],
    excluded_employers: ['General Dynamics'],
    skip_if_requires: ['SWPP'],
    location: 'canada_only',
    target_roles: ['software engineering intern'],
    daily_cap: 20,
  },
} as const;

export const validRun = {
  id: '2026-11-05T14-00-00Z-pipeline',
  kind: 'pipeline',
  status: 'partial',
  commit: '3c22f9b',
  startedAt: new Date('2026-11-05T14:00:00Z'),
  finishedAt: new Date('2026-11-05T14:04:30Z'),
  sources: {
    simplify: { fetched: 520, valid: 518, invalid: 2, new: 9, changed: 3 },
  },
  filterReasons: { location: 40, values: 1 },
  triageDecisions: { apply: 4, maybe: 3, skip: 2 },
  tokens: { input: 13500, output: 9000, cacheRead: 27000 },
  costUsd: 0.31,
  errors: [
    {
      step: 'collect',
      target: 'vansh',
      message: 'timed out after 30 s',
      at: new Date('2026-11-05T14:01:00Z'),
    },
  ],
} as const;
