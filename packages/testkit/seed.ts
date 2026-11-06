// The data `pnpm dev` loads into the Firestore emulator: a few invented jobs and applications in
// different stages, so every dashboard page has something to show. No real person or company.
import type {
  AgentConfig,
  Application,
  Job,
  MemoryEntry,
  Profile,
  Question,
  Run,
  StageEvent,
} from '@scout/core';
import {
  NOW,
  aJob,
  aMemoryEntry,
  aProfile,
  aQuestion,
  aRun,
  anAgentConfig,
  anApplication,
} from './builders';

export interface DevSeed {
  profile: Profile;
  agentConfig: AgentConfig;
  memory: MemoryEntry[];
  jobs: Job[];
  applications: { app: Application; events: StageEvent[] }[];
  questions: Question[];
  runs: Run[];
}

const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

function move(from: StageEvent['from'], to: StageEvent['to'], at: Date, by: StageEvent['by']) {
  return { from, to, by, at, detail: null } satisfies StageEvent;
}

export function devSeed(): DevSeed {
  const northwind = aJob({
    triage: {
      decision: 'apply',
      score: 82,
      reasons: ['Backend internship in Toronto for Winter 2027', 'Go and observability match mint'],
      lead: 'backend',
      flags: [],
    },
  });
  const northwindSenior = aJob({
    key: 'greenhouse:northwind:4100002',
    postingId: '4100002',
    title: 'Senior Robotics Engineer',
    applyUrl: 'https://job-boards.greenhouse.io/northwind/jobs/4100002',
    rawTerm: null,
    terms: [],
    contentHash: 'b'.repeat(64),
    filter: { passed: false, reasons: ['role'], flags: ['term_unknown'] },
  });
  const maple = aJob({
    key: 'lever:mapleledger:7d1e2f',
    ats: 'lever',
    boardToken: 'mapleledger',
    postingId: '7d1e2f',
    company: 'Maple Ledger',
    title: 'DevOps Co-op',
    locations: ['Calgary, AB, Canada'],
    rawTerm: 'Summer 2027',
    terms: ['Summer 2027'],
    applyUrl: 'https://jobs.lever.co/mapleledger/7d1e2f',
    contentHash: 'c'.repeat(64),
    sources: [{ name: 'simplify', url: null }],
    triage: {
      decision: 'apply',
      score: 74,
      reasons: ['DevOps co-op in Calgary', 'CI and Terraform work fits'],
      lead: 'devops',
      flags: [],
    },
  });
  const aurora = aJob({
    key: 'ashby:aurora:a1b2c3',
    ats: 'ashby',
    boardToken: 'aurora',
    postingId: 'a1b2c3',
    company: 'Aurora Analytics',
    title: 'Machine Learning Intern',
    locations: ['Remote in Canada'],
    applyUrl: 'https://jobs.ashbyhq.com/aurora/a1b2c3',
    contentHash: 'e'.repeat(64),
    sources: [{ name: 'you', url: 'https://jobs.ashbyhq.com/aurora/a1b2c3' }],
    triage: {
      decision: 'maybe',
      score: 61,
      reasons: ['Remote ML internship', 'Asks for research experience'],
      lead: 'ai',
      flags: [],
    },
  });

  const northwindApp = anApplication({ stage: 'needs_answers', stageAt: minutes(6) });
  const mapleApp = anApplication({
    jobKey: maple.key,
    company: maple.company,
    title: maple.title,
    stage: 'review',
    stageAt: minutes(7),
  });
  const auroraApp = anApplication({
    jobKey: aurora.key,
    company: aurora.company,
    title: aurora.title,
    stage: 'applied',
    stageAt: minutes(300),
    submittedAt: minutes(300),
    confirmationText: 'Thanks for applying to Aurora Analytics!',
  });

  return {
    profile: aProfile(),
    agentConfig: anAgentConfig(),
    memory: [aMemoryEntry()],
    jobs: [northwind, northwindSenior, maple, aurora],
    applications: [
      {
        app: northwindApp,
        events: [
          move(null, 'queued', NOW, 'pipeline'),
          move('queued', 'planning', minutes(1), 'pipeline'),
          move('planning', 'needs_answers', minutes(6), 'pipeline'),
        ],
      },
      {
        app: mapleApp,
        events: [
          move(null, 'queued', NOW, 'you'),
          move('queued', 'planning', minutes(2), 'pipeline'),
          move('planning', 'review', minutes(7), 'pipeline'),
        ],
      },
      {
        app: auroraApp,
        events: [
          move(null, 'queued', NOW, 'you'),
          move('queued', 'planning', minutes(1), 'pipeline'),
          move('planning', 'review', minutes(5), 'pipeline'),
          move('review', 'approved', minutes(60), 'you'),
          move('approved', 'filling', minutes(295), 'agent'),
          move('filling', 'applied', minutes(300), 'agent'),
        ],
      },
    ],
    questions: [aQuestion({ askedAt: minutes(6) })],
    runs: [
      aRun({ sources: { simplify: { fetched: 4, valid: 4, invalid: 0, new: 4, changed: 0 } } }),
    ],
  };
}
