// `pnpm scout profile push`: seeds `profile/main` and `memory/{questionKey}` from the YAML files
// (#4). The files only seed Firestore; after that the dashboard edits the profile there.
import type { MemoryEntry, Store } from '@scout/core';
import { diffPaths, readSeedFiles, type ProfilePaths } from './files';

export { ProfileValidationError } from './files';

export interface PushReport {
  /** Profile paths that change, like `~ identity.phone`. */
  profile: string[];
  /** Remembered answers added (`+`) or changed (`~`), by question. */
  memory: string[];
  wrote: boolean;
}

/**
 * Validates both files, then writes only what differs from Firestore. Pushing the same files twice
 * writes nothing. Use counts already in Firestore are kept. With `dryRun`, nothing is written.
 */
export async function pushProfile(
  store: Store,
  paths: ProfilePaths,
  options: { dryRun?: boolean } = {},
): Promise<PushReport> {
  const seed = await readSeedFiles(paths);

  const current = await store.profile.get();
  const profileChanges = diffPaths(current, seed.profile);

  const memoryWrites: MemoryEntry[] = [];
  const memoryChanges: string[] = [];
  for (const entry of seed.memory) {
    const existing = await store.memory.get(entry.questionKey);
    const next: MemoryEntry = {
      ...entry,
      timesUsed: existing?.timesUsed ?? 0,
      lastUsedAt: existing?.lastUsedAt ?? null,
    };
    if (!existing) memoryChanges.push(`+ ${entry.question}`);
    else if (diffPaths(existing, next).length > 0) memoryChanges.push(`~ ${entry.question}`);
    else continue;
    memoryWrites.push(next);
  }

  const changed = profileChanges.length > 0 || memoryWrites.length > 0;
  if (options.dryRun || !changed) {
    return { profile: profileChanges, memory: memoryChanges, wrote: false };
  }
  if (profileChanges.length > 0) await store.profile.put(seed.profile);
  for (const entry of memoryWrites) await store.memory.put(entry);
  return { profile: profileChanges, memory: memoryChanges, wrote: true };
}
