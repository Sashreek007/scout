// The daily run (#13): `pnpm pipeline` from the repo root, which GitHub Actions runs every morning
// from .github/workflows/daily.yml. It reads .env when there is one, so it also runs on the
// Mac. It exits 1 when the run failed, so the workflow shows it and sends its failure notice.
import { existsSync } from 'node:fs';
import { runPipeline } from './pipeline';
import { productionDeps } from './production';

if (existsSync('.env')) process.loadEnvFile('.env');
const { deps, target } = await productionDeps();
const run = await runPipeline(deps);
console.log(
  `Run ${run.id} on ${target}: ${run.status}. ${String(run.jobs.new)} new, ${String(run.jobs.changed)} changed, ` +
    `${String(run.triageDecisions.apply ?? 0)} apply, ${String(run.errors.length)} errors. ${run.digest?.title ?? 'No digest.'}`,
);
process.exitCode = run.status === 'failed' ? 1 : 0;
