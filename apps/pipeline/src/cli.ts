// `pnpm scout <command>`: the commands Sashreek runs by hand.
//
//   pnpm scout profile push [--dry-run] [--profile path] [--answers path]
//   pnpm scout profile pull [--profile path]
//   pnpm scout notify-failure --since <ISO time> --link <url>   (the daily workflow's failure step)
//   pnpm scout backup --to <folder>                            (the nightly backup, #58)
//   pnpm scout restore --date <YYYY-MM-DD> (--collection <name> | --all) [--from <folder>] [--confirm]
//
// It reads .env if there is one. With FIRESTORE_EMULATOR_HOST set it works on the local emulator.
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { FirestoreStore, PushNotifier, connectFirestore, firebaseMessaging } from '@scout/adapters';
import { backupNow, restoreBackup } from './backup';
import { notifyFailure } from './notify-failure';
import { DEFAULT_PATHS, ProfileValidationError } from './profile/files';
import { pullProfile } from './profile/pull';
import { pushProfile } from './profile/push';

const USAGE = `usage:
  pnpm scout profile push [--dry-run] [--profile path] [--answers path]
  pnpm scout profile pull [--profile path]
  pnpm scout notify-failure --since <ISO time> --link <url>
  pnpm scout backup --to <folder>
  pnpm scout restore --date <YYYY-MM-DD> (--collection <name> | --all) [--from <folder>] [--confirm]`;

async function main(argv: string[]): Promise<number> {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      'dry-run': { type: 'boolean', default: false },
      profile: { type: 'string', default: DEFAULT_PATHS.profile },
      answers: { type: 'string', default: DEFAULT_PATHS.answers },
      since: { type: 'string' },
      link: { type: 'string' },
      to: { type: 'string' },
      from: { type: 'string', default: '../scout-backups' },
      date: { type: 'string' },
      collection: { type: 'string' },
      all: { type: 'boolean', default: false },
      confirm: { type: 'boolean', default: false },
    },
  });
  const command = positionals.join(' ');
  if (!['profile push', 'profile pull', 'notify-failure', 'backup', 'restore'].includes(command)) {
    console.error(USAGE);
    return 2;
  }

  if (existsSync('.env')) process.loadEnvFile('.env');
  if (command === 'restore') {
    const one = values.collection ?? null;
    if (!values.date || (one === null) === !values.all) {
      console.error(USAGE);
      return 2;
    }
    // The emulator first: production only on purpose.
    if (!process.env.FIRESTORE_EMULATOR_HOST && !values.confirm) {
      console.error(
        'Restore into the emulator first (start it with pnpm emulators), check it, then run again ' +
          'with --confirm to write the production project.',
      );
      return 1;
    }
  }
  const { db, target } = connectFirestore();
  const store = new FirestoreStore(db);

  if (command === 'backup') {
    if (!values.to) {
      console.error(USAGE);
      return 2;
    }
    const result = await backupNow(db, values.to, new Date());
    console.log(
      `Exported ${target} to ${result.folder}: ${String(result.reads)} documents read. ` +
        `Pruned ${String(result.pruned.length)} old folders.`,
    );
    return 0;
  }

  if (command === 'restore') {
    const written = await restoreBackup(db, {
      dir: values.from,
      date: values.date ?? '',
      collection: values.collection ?? null,
    });
    console.log(`Restored ${String(written)} documents from ${values.date ?? ''} into ${target}.`);
    return 0;
  }

  if (command === 'notify-failure') {
    const since = new Date(values.since ?? '');
    if (Number.isNaN(since.getTime()) || !values.link) {
      console.error(USAGE);
      return 2;
    }
    const notifier = new PushNotifier({ messaging: firebaseMessaging(), devices: store.devices });
    const sent = await notifyFailure({ store, notifier, since, link: values.link });
    console.log(sent ? 'Sent the failure notice.' : 'The run already sent its own digest.');
    return 0;
  }
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
