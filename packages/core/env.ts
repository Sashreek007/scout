import { z } from 'zod';

/**
 * Every environment variable scout's apps read. `.env.example` lists exactly these, with no values,
 * and a test keeps the two in step. Secrets never go anywhere but `.env` on the Mac and GitHub
 * Actions secrets.
 */
export const EnvSchema = z.strictObject({
  /** Claude API key for the pipeline and the scout server. Secret. */
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  /** Points the Anthropic SDK somewhere else; `pnpm dev` sets it to the fake Claude. */
  ANTHROPIC_BASE_URL: z.url().optional(),
  /** `scout-dev` or `scout-prod`. */
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  /** The service account key as JSON, for the Admin SDK. The most sensitive secret here. */
  FIREBASE_SERVICE_ACCOUNT: z.string().min(1).optional(),
  /** Set by the Firebase emulator. When set, the Admin SDK talks to it instead of Google. */
  FIRESTORE_EMULATOR_HOST: z.string().min(1).optional(),
  FIREBASE_AUTH_EMULATOR_HOST: z.string().min(1).optional(),
  /** Sends job-board requests to the fake job board instead of the real hosts, in local dev. */
  SCOUT_BOARD_BASE_URL: z.url().optional(),
});
export type Env = z.infer<typeof EnvSchema>;

export const ENV_VARIABLES = Object.keys(EnvSchema.shape) as (keyof Env)[];
