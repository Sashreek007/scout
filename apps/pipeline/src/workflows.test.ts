// The workflows can't run in a test, so their shape is checked instead (#13).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface Step {
  name?: string;
  uses?: string;
  run?: string;
  if?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
}
interface Workflow {
  on: Record<string, unknown>;
  concurrency?: { group: string; 'cancel-in-progress': boolean };
  jobs: Record<string, { 'timeout-minutes'?: number; steps: Step[] }>;
}
const read = (name: string) => parse(readFileSync(`.github/workflows/${name}`, 'utf8')) as Workflow;

describe('daily.yml', () => {
  const daily = read('daily.yml');
  const job = daily.jobs.pipeline;
  if (!job) throw new Error('daily.yml has no pipeline job');
  const step = (name: string) => job.steps.find((s) => s.name === name);

  it('runs at 14:00 UTC every day and by hand', () => {
    expect(daily.on).toEqual({ schedule: [{ cron: '0 14 * * *' }], workflow_dispatch: null });
  });

  it('never runs twice at once, and stops after 20 minutes', () => {
    expect(daily.concurrency).toEqual({ group: 'daily-run', 'cancel-in-progress': false });
    expect(job['timeout-minutes']).toBe(20);
  });

  it('uses Node from .nvmrc with the pnpm cache', () => {
    const node = job.steps.find((s) => s.uses?.startsWith('actions/setup-node@'));
    expect(node?.with).toEqual({ 'node-version-file': '.nvmrc', cache: 'pnpm' });
    expect(job.steps.some((s) => s.uses?.startsWith('pnpm/action-setup@'))).toBe(true);
    expect(job.steps.some((s) => s.run === 'pnpm install --frozen-lockfile')).toBe(true);
  });

  it('gives the pipeline its two secrets from the repository, and prints neither', () => {
    const run = step('Run the pipeline');
    expect(run?.run).toBe('pnpm pipeline');
    expect(run?.env).toMatchObject({
      ANTHROPIC_API_KEY: '${{ secrets.ANTHROPIC_API_KEY }}',
      FIREBASE_SERVICE_ACCOUNT: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}',
    });
    const secrets = JSON.stringify(daily).match(/secrets\.\w+/g) ?? [];
    expect([...new Set(secrets)].sort()).toEqual([
      'secrets.ANTHROPIC_API_KEY',
      'secrets.FIREBASE_SERVICE_ACCOUNT',
    ]);
    for (const s of job.steps) expect(s.run ?? '').not.toMatch(/echo .*(secrets|KEY|ACCOUNT)/);
  });

  it('sends a failure notice when any step failed, unless the run reported itself', () => {
    const notify = step('Tell the phone the run failed');
    expect(notify?.if).toBe('failure()');
    expect(notify?.run).toBe('pnpm scout notify-failure --since "$STARTED_AT" --link "$RUN_URL"');
    expect(job.steps[0]?.name).toBe('Note the start time');
    expect(job.steps.at(-1)).toBe(notify);
  });
});

describe('ci.yml', () => {
  const ci = read('ci.yml');

  it('runs pnpm check, rules tests included, on every push to main and every pull request', () => {
    expect(Object.keys(ci.on).sort()).toEqual(['pull_request', 'push']);
    const check = ci.jobs.check?.steps.find((s) => s.run === 'pnpm check');
    expect(check).toBeDefined();
    // pnpm test runs every suite inside the Firestore emulator, the rules tests among them.
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.check).toContain('pnpm test');
    expect(pkg.scripts.test).toContain('firebase emulators:exec');
  });
});
