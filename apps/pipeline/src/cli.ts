// `pnpm scout <command>`: the commands Sashreek runs by hand.
//
//   pnpm scout profile push [--dry-run] [--profile path] [--answers path]
//   pnpm scout profile pull [--profile path]
//
// It reads .env if there is one. With FIRESTORE_EMULATOR_HOST set it works on the local emulator.
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { FirestoreStore, connectFirestore } from '@scout/adapters';
import { DEFAULT_PATHS, ProfileValidationError } from './profile/files';
import { pullProfile } from './profile/pull';
import { pushProfile } from './profile/push';

const USAGE = `usage:
  pnpm scout profile push [--dry-run] [--profile path] [--answers path]
  pnpm scout profile pull [--profile path]`;

async function main(argv: string[]): Promise<number> {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      'dry-run': { type: 'boolean', default: false },
      profile: { type: 'string', default: DEFAULT_PATHS.profile },
      answers: { type: 'string', default: DEFAULT_PATHS.answers },
    },
  });
  const command = positionals.join(' ');
  if (command !== 'profile push' && command !== 'profile pull') {
    console.error(USAGE);
    return 2;
  }

  if (existsSync('.env')) process.loadEnvFile('.env');
  const { db, target } = connectFirestore();
  const store = new FirestoreStore(db);
  const paths = { profile: values.profile, answers: values.answers };

  if (command === 'profile pull') {
    const { changed } = await pullProfile(store, paths);
    console.log(
      changed.length === 0
        ? `${paths.profile} already matches ${target}.`
        : `Wrote ${paths.profile} from ${target}:\n${changed.join('\n')}`,
    );
    return 0;
  }

  const dryRun = values['dry-run'];
  try {
    const report = await pushProfile(store, paths, { dryRun });
    const lines = [...report.profile, ...report.memory.map((line) => `${line} (memory)`)];
    if (lines.length === 0) console.log(`Nothing to change on ${target}.`);
    else console.log(`${dryRun ? 'Would change' : 'Changed'} on ${target}:\n${lines.join('\n')}`);
    return 0;
  } catch (error) {
    if (!(error instanceof ProfileValidationError)) throw error;
    console.error(`Nothing was written. Fix these first:\n${error.problems.join('\n')}`);
    return 1;
  }
}

process.exitCode = await main(process.argv.slice(2));
