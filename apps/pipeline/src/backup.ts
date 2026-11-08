// `pnpm scout backup` and `pnpm scout restore` (#58): the nightly export of every collection to a
// dated folder of JSON files, which the workflow commits to the private scout-backups repository,
// and putting one collection or all of them back.
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { connectFirestore } from '@scout/adapters';
import {
  countDocuments,
  exportFirestore,
  restoreFirestore,
  type Backup,
  type BackupDoc,
} from '@scout/adapters';
import { backupFolder, foldersToPrune } from '@scout/core';

type Firestore = ReturnType<typeof connectFirestore>['db'];

/** The Spark plan allows 50,000 reads a day; the nightly export stays under a tenth of that. */
export const BACKUP_READ_BUDGET = 5000;

export interface Manifest {
  date: string;
  exportedAt: string;
  reads: number;
  /** Documents per top-level collection, subcollections counted in. */
  counts: Record<string, number>;
}

export interface BackupResult extends Manifest {
  folder: string;
  pruned: string[];
}

/**
 * Exports every collection into `{dir}/{YYYY-MM-DD}/`, one `{collection}.json` each with a
 * `manifest.json`, then deletes the folders past their keep date. Throws, writing nothing, if the
 * export read more than the 5,000-document budget, so a growing collection is noticed early.
 */
export async function backupNow(db: Firestore, dir: string, now: Date): Promise<BackupResult> {
  const { backup, reads } = await exportFirestore(db);
  if (reads > BACKUP_READ_BUDGET) {
    throw new Error(
      `the export read ${String(reads)} documents, over the ${String(BACKUP_READ_BUDGET)} budget; nothing was written`,
    );
  }
  const date = backupFolder(now);
  const folder = join(dir, date);
  await rm(folder, { recursive: true, force: true });
  await mkdir(folder, { recursive: true });
  for (const [name, docs] of Object.entries(backup)) {
    await writeFile(join(folder, `${name}.json`), `${JSON.stringify(docs, null, 2)}\n`);
  }
  const manifest: Manifest = {
    date,
    exportedAt: now.toISOString(),
    reads,
    counts: countDocuments(backup),
  };
  await writeFile(join(folder, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  const folders = (await readdir(dir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const pruned = foldersToPrune(folders, now);
  for (const name of pruned) await rm(join(dir, name), { recursive: true, force: true });
  return { ...manifest, folder, pruned };
}

/** One day's backup from its folder: every collection, or only the ones named. */
export async function readBackup(
  dir: string,
  date: string,
  only?: readonly string[],
): Promise<Backup> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error(`expected a date like 2026-11-04, not ${date}`);
  const folder = join(dir, date);
  const files = (await readdir(folder)).filter(
    (name) => name.endsWith('.json') && name !== 'manifest.json',
  );
  const backup: Backup = {};
  for (const file of files.sort()) {
    const name = file.slice(0, -'.json'.length);
    if (only && !only.includes(name)) continue;
    backup[name] = JSON.parse(await readFile(join(folder, file), 'utf8')) as BackupDoc[];
  }
  for (const name of only ?? []) {
    if (!backup[name]) throw new Error(`the backup from ${date} has no ${name} collection`);
  }
  return backup;
}

export interface RestoreRequest {
  dir: string;
  date: string;
  /** One collection, or every collection in the backup when null. */
  collection: string | null;
}

/** Writes a day's backup back, one collection or all, and says how many documents it wrote. */
export async function restoreBackup(db: Firestore, request: RestoreRequest): Promise<number> {
  const only = request.collection === null ? undefined : [request.collection];
  const backup = await readBackup(request.dir, request.date, only);
  return restoreFirestore(db, backup, Object.keys(backup));
}
