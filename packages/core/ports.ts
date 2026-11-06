// The ports: small interfaces for everything that talks to the outside world (docs/architecture.md,
// section 3). packages/core depends only on these; packages/adapters implements them, and
// packages/testkit has the fakes the tests use.
import type {
  AnswerValue,
  Application,
  FormSpec,
  Job,
  JobKey,
  Listing,
  MemoryEntry,
  Profile,
  Question,
  Run,
  Sheet,
  SheetAnswer,
  Stage,
  StageEvent,
  Triage,
} from './schemas';

/** A place postings come from: a GitHub list or a job board's public feed. */
export interface JobSource {
  id: string;
  fetch(): Promise<Listing[]>;
}

/** Reads an application form before any browser opens, where the board allows it. */
export interface FormReader {
  canRead(job: Job): boolean;
  read(job: Job): Promise<FormSpec>;
}

/** What a filler did on the page, checked against the sheet before anything is submitted. */
export interface FillReport {
  filled: string[];
  /** Fields the filler couldn't find on the page. */
  missing: string[];
  /** Fields whose value read back from the page differs from the sheet. */
  mismatches: { fieldId: string; expected: AnswerValue; actual: string | null }[];
}

export interface SubmitResult {
  status: 'confirmed' | 'no_confirmation' | 'captcha' | 'error';
  url: string;
  /** The first 500 characters of the confirmation page, when there was one. */
  confirmationText: string | null;
}

/**
 * Fills one board's form in a browser page. The page type comes from the adapter (Playwright's
 * `Page` in apps/agent), because core never imports a browser.
 */
export interface FormFiller<Page = unknown> {
  canFill(app: Application): boolean;
  fill(page: Page, sheet: Sheet): Promise<FillReport>;
  submit(page: Page): Promise<SubmitResult>;
}

/** Fields an application may change outside the stage machine. */
export type ApplicationPatch = Partial<
  Omit<Application, 'jobKey' | 'stage' | 'stageAt' | 'createdAt'>
>;

/**
 * Firestore, or the in-memory store in tests. Every write is checked against its schema, and every
 * read returns a copy. An application's stage changes only through the stage machine (#2).
 */
export interface Store {
  readonly jobs: {
    get(key: JobKey): Promise<Job | null>;
    put(job: Job): Promise<void>;
    list(): Promise<Job[]>;
  };
  readonly applications: {
    get(key: JobKey): Promise<Application | null>;
    /** Creates the application with its first event. Fails if one already exists for the job. */
    create(app: Application, event: StageEvent): Promise<void>;
    /** Changes anything but the stage. Fails if the application doesn't exist. */
    update(key: JobKey, patch: ApplicationPatch): Promise<void>;
    list(filter?: { stage?: Stage }): Promise<Application[]>;
    /** Every stage event, oldest first. */
    events(key: JobKey): Promise<StageEvent[]>;
  };
  readonly questions: {
    get(id: string): Promise<Question | null>;
    put(question: Question): Promise<void>;
    list(filter?: { status?: Question['status'] }): Promise<Question[]>;
  };
  readonly memory: {
    get(questionKey: string): Promise<MemoryEntry | null>;
    put(entry: MemoryEntry): Promise<void>;
    list(): Promise<MemoryEntry[]>;
  };
  readonly profile: {
    get(): Promise<Profile | null>;
    put(profile: Profile): Promise<void>;
  };
  readonly runs: {
    get(id: string): Promise<Run | null>;
    put(run: Run): Promise<void>;
    list(): Promise<Run[]>;
  };
}

export interface Notice {
  kind: 'digest' | 'live_question' | 'needs_hand' | 'failure';
  /** One short line, like "9 new matches, 4 questions waiting". */
  title: string;
  body: string | null;
  /** The dashboard page the notification opens. */
  url: string;
}

/** macOS notifications from the Mac app, and web push to the phone. */
export interface Notifier {
  send(message: Notice): Promise<void>;
}

/** What the planner sends Claude for the fields the rules and memory passes left (#17). */
export interface PlanInput {
  job: Job;
  form: FormSpec;
  profile: Profile;
  memory: MemoryEntry[];
  /** Answers the earlier passes already found, so Claude sees what's settled. */
  answered: SheetAnswer[];
}

/** One field Claude planned: a grounded fact, a draft for him to edit, or unknown (#17). */
export interface PlannedField {
  fieldId: string;
  kind: 'fact' | 'draft' | 'unknown';
  value: AnswerValue | null;
  /** The profile path a fact came from. */
  evidence: string | null;
  note: string | null;
}

export interface PlanResult {
  fields: PlannedField[];
}

/** Every Claude call goes through here, so model, effort and account are set per task (#39). */
export interface Llm {
  triage(job: Job, profile: Profile): Promise<Triage>;
  plan(input: PlanInput): Promise<PlanResult>;
}
