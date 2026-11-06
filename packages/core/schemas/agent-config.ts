import { z } from 'zod';

/** The agent's steps, each an activity with its own timeout and retry policy (section 5c). */
export const AGENT_STEPS = ['open', 'fill', 'readBack', 'askLive', 'submit', 'confirm'] as const;

const FinalClick = z.enum(['hold', 'auto']);

/**
 * `config/agent`: every agent setting, editable in Settings and read at the start of each loop.
 * A missing field takes its default, so an empty document is a valid config (#39).
 */
export const AgentConfigSchema = z.strictObject({
  paused: z.boolean().default(false),
  /** Applications a day across all workers. `null` turns the cap off. */
  dailyCap: z.int().positive().nullable().default(20),
  workers: z.int().min(1).max(8).default(3),
  perCompany: z.int().min(1).default(1),
  perBoard: z.int().min(1).default(2),
  /** The random wait between one worker's applications, 2 to 5 minutes by default. */
  paceSeconds: z
    .strictObject({
      min: z.int().min(0).default(120),
      max: z.int().min(0).default(300),
    })
    .refine((pace) => pace.min <= pace.max, { message: 'min must not exceed max' })
    .prefault({}),
  liveQuestionMinutes: z.int().min(1).max(60).default(10),
  stepTimeouts: z
    .strictObject({
      open: z.int().positive().default(60),
      fill: z.int().positive().default(300),
      readBack: z.int().positive().default(60),
      askLive: z.int().positive().default(600),
      submit: z.int().positive().default(60),
      confirm: z.int().positive().default(60),
    })
    .prefault({}),
  stepRetries: z
    .strictObject({
      open: z.int().min(0).max(5).default(2),
      fill: z.int().min(0).max(5).default(1),
      readBack: z.int().min(0).max(5).default(1),
      askLive: z.int().min(0).max(5).default(0),
      /** Submit is never retried automatically (section 5c). */
      submit: z.literal(0).default(0),
      confirm: z.int().min(0).max(5).default(0),
    })
    .prefault({}),
  /** `hold` stops on the filled form for him to click Submit; `auto` clicks it. */
  finalClick: z
    .strictObject({
      greenhouse: FinalClick.default('hold'),
      lever: FinalClick.default('hold'),
      ashby: FinalClick.default('hold'),
      workday: FinalClick.default('hold'),
      other: FinalClick.default('hold'),
    })
    .prefault({}),
  /** Triage scores at or above this go straight to `queued`. */
  autoQueueScore: z.int().min(0).max(100).default(80),
  maxTriagePerRun: z.int().min(1).default(60),
  /** The Stagehand filler for boards without their own (#40). Off until it ships. */
  genericFiller: z.boolean().default(false),
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
