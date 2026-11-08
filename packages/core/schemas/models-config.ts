import { z } from 'zod';

/** Effort levels, from `output_config.effort`. */
export const EffortSchema = z.enum(['low', 'medium', 'high', 'xhigh', 'max']);
export type Effort = z.infer<typeof EffortSchema>;

/** How one task calls Claude (docs/architecture.md, section 5c, "Which model, and whose account"). */
const task = (defaults: {
  model: string;
  effort: Effort;
  refusalModel: string | null;
  batch: boolean;
}) =>
  z
    .strictObject({
      /** `api` by default. The subscription option is #41, and only on the Mac. */
      account: z.enum(['api', 'subscription']).default('api'),
      model: z.string().min(1).default(defaults.model),
      effort: EffortSchema.default(defaults.effort),
      /**
       * Where a refused call is tried again, in code. Haiku has no server-side fallback, so
       * triage retries on Sonnet. Null when the model's own server-side fallback is enough.
       */
      refusalModel: z.string().min(1).nullable().default(defaults.refusalModel),
      /** Through the Batches API, at half price, when the task can wait minutes for an answer. */
      batch: z.boolean().default(defaults.batch),
    })
    .prefault({});

/**
 * `config/models`: for each task, the account, model and effort. A missing field takes its
 * default, so an empty document is a valid config. Settings edits it (#39).
 */
export const ModelsConfigSchema = z.strictObject({
  triage: task({
    model: 'claude-haiku-5-5',
    effort: 'low',
    refusalModel: 'claude-sonnet-5-5',
    batch: true,
  }),
  planning: task({
    model: 'claude-sonnet-5-5',
    effort: 'medium',
    refusalModel: null,
    batch: false,
  }),
  tailoring: task({ model: 'claude-sonnet-5-5', effort: 'high', refusalModel: null, batch: false }),
  fieldHelp: task({ model: 'claude-sonnet-5-5', effort: 'low', refusalModel: null, batch: false }),
  reading: task({
    model: 'claude-haiku-5-5',
    effort: 'low',
    refusalModel: 'claude-sonnet-5-5',
    batch: false,
  }),
});
export type ModelsConfig = z.infer<typeof ModelsConfigSchema>;
export type TaskModel = ModelsConfig['triage'];
