// The ports: small interfaces for everything that talks to the outside world (docs/architecture.md,
// section 3). packages/core depends only on these; packages/adapters implements them, and
// packages/testkit has the fakes the tests use.
import type { TokenUsage } from './prices';
import type {
  Actor,
  AgentConfig,
  AnswerValue,
  Application,
  Device,
  FormSpec,
  Job,
  JobKey,
  Listing,
  MemoryEntry,
  ModelsConfig,
  Profile,
  Question,
  Run,
  Sheet,
  SheetAnswer,
  Stage,
  StageEvent,
  Triage,
} from './schemas';

/**
 * A part of a source that couldn't be read this run, like one job board that answered 404. The rest
 * of the batch is still good; the run log (#11) records each one.
 */
export interface SkippedTarget {
  /** What was skipped, like `greenhouse:tribalscale`. */
  target: string;
  /** The HTTP status it answered with, or null for a timeout, the network or a bad body. */
  status: number | null;
  message: string;
}

/** What one source produced in one fetch: its valid listings, and how many raw rows it read. */
export interface SourceBatch {
  listings: Listing[];
  /** Raw rows read before validation. */
  fetched: number;
  /** Rows that failed validation and were skipped. */
  invalid: number;
  /** Parts of the source that couldn't be read, like a job board that is gone. */
  skipped: SkippedTarget[];
}

/**
 * A place postings come from: a GitHub list, or one ATS's public board feeds. `fetch` throws when
 * the source can't be read at all; the collect step records that and carries on with the others.
 */
export interface JobSource {
  id: string;
  fetch(): Promise<SourceBatch>;
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

/** A stage move as the store receives it: the stage the caller saw, and where it goes. */
export interface StageMoveRequest {
  from: Stage;
  to: Stage;
  by: Actor;
  detail?: string | null;
  /** When the move happened. Defaults to now; tests pass a fixed time. */
  at?: Date;
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
    /**
     * Writes many jobs, in batches of at most 500 writes (#7). Every job is checked against its
     * schema before the first batch, so one bad job writes nothing.
     */
    putMany(jobs: readonly Job[]): Promise<void>;
    list(): Promise<Job[]>;
  };
  readonly applications: {
    get(key: JobKey): Promise<Application | null>;
    /**
     * Creates the application in `queued` with its first event (see `firstEvent`). Fails if one
     * already exists for the job.
     */
    create(app: Application, event: StageEvent): Promise<void>;
    /** Changes anything but the stage. Fails if the application doesn't exist. */
    update(key: JobKey, patch: ApplicationPatch): Promise<void>;
    list(filter?: { stage?: Stage }): Promise<Application[]>;
    /** Every stage event, oldest first. */
    events(key: JobKey): Promise<StageEvent[]>;
  };
  /**
   * Moves an application along the stage machine and writes its event, in one transaction. Inside
   * it, the stage is read again: if it is no longer `from`, the move fails with StaleStageError and
   * nothing is written, so two concurrent moves can't both succeed. A move the table doesn't allow
   * fails with IllegalMoveError. Events are only ever added, never changed or deleted.
   */
  moveStage(key: JobKey, move: StageMoveRequest): Promise<{ app: Application; event: StageEvent }>;
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
    /** Deletes every run that started before `cutoff`, and says how many (#11). */
    deleteBefore(cutoff: Date): Promise<number>;
  };
  /** The devices that get push notifications, by FCM token (#12). */
  readonly devices: {
    list(): Promise<Device[]>;
    put(device: Device): Promise<void>;
    /** Removes a device FCM says is no longer registered. Removing one that isn't there is fine. */
    remove(token: string): Promise<void>;
  };
  /** The settings documents. Each reads as its defaults when the document is missing. */
  readonly config: {
    readonly agent: { get(): Promise<AgentConfig>; put(config: AgentConfig): Promise<void> };
    readonly models: { get(): Promise<ModelsConfig>; put(config: ModelsConfig): Promise<void> };
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

/** What triage gave for one job (#9). */
export interface TriageOutcome {
  jobKey: JobKey;
  /**
   * The triage, or why there is none: every model it was tried on refused, or the call failed or
   * gave an answer that didn't fit the schema. A job with no triage is picked up by the next run.
   */
  result:
    { ok: true; triage: Triage } | { ok: false; reason: 'refusal' | 'error'; message: string };
  /** The model that answered, or that refused last. Null when no model answered. */
  model: string | null;
}

/** Every job's outcome from one triage call, with the tokens it used and what they cost. */
export interface TriageRun {
  outcomes: TriageOutcome[];
  usage: TokenUsage;
  /** Estimated from the token counts and `prices.ts`. */
  costUsd: number;
}

/** Every Claude call goes through here, so model, effort and account are set per task (#39). */
export interface Llm {
  /**
   * Triages many jobs at once, one outcome per job in no particular order. The default model goes
   * through the Batches API at half price (#9). Throws only when nothing could be sent at all.
   */
  triage(jobs: readonly Job[], profile: Profile): Promise<TriageRun>;
  plan(input: PlanInput): Promise<PlanResult>;
}
