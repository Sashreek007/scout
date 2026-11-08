import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FirestoreStore,
  clearEmulator,
  countDocuments,
  emulatorFirestore,
  exportFirestore,
} from '@scout/adapters';
import { aCreationEvent, aProfile, anApplication, startFakeJobBoard } from '@scout/testkit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BACKUP_READ_BUDGET, backupNow, readBackup, restoreBackup } from './backup';
import { runPipeline } from './pipeline';
import { clockAt, fixturePipeline } from './pipeline.fixture';

const YESTERDAY = new Date('2026-11-04T09:00:00Z');
const db = emulatorFirestore();

/** The emulator after a real run on the saved fixtures, plus an application history and the knowledge base. */
async function seed() {
  await clearEmulator();
  const store = new FirestoreStore(db);
  await store.profile.put(aProfile());
  const board = await startFakeJobBoard();
  try {
    await runPipeline(
      await fixturePipeline(store, board, clockAt(new Date('2026-11-04T08:00:00Z'))),
    );
  } finally {
    await board.close();
  }
  const [job] = await store.jobs.list();
  if (!job) throw new Error('nothing was collected');
  const app = anApplication({ jobKey: job.key, stage: 'queued' });
  await store.applications.create(app, aCreationEvent(app));
  await store.moveStage(job.key, {
    from: 'queued',
    to: 'planning',
    by: 'pipeline',
    at: new Date('2026-11-04T08:10:00Z'),
  });
  // The knowledge base keeps its entries under kb/{kind}/items, with no kb/{kind} document itself.
  await db
    .doc('kb/facts/items/fact-1')
    .set({ claim: 'mint cut /validate p99 from 17 to 10 ms', status: 'verified' });
  await db.doc('config/agent').set({ autoQueueScore: 85 });
}

describe('the nightly backup and restore', { timeout: 60_000 }, () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'scout-backups-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("restores yesterday's export into the emulator with the same document counts", async () => {
    await seed();
    const before = countDocuments((await exportFirestore(db)).backup);
    const result = await backupNow(db, dir, YESTERDAY);
    expect(result.folder).toBe(join(dir, '2026-11-04'));
    expect(result.counts).toEqual(before);
    expect(before).toMatchObject({
      jobs: 647,
      applications: 3,
      kb: 1,
      profile: 1,
      config: 1,
      runs: 1,
    });

    await clearEmulator();
    expect(await exportFirestore(db)).toEqual({ backup: {}, reads: 0 });
    const written = await restoreBackup(db, { dir, date: '2026-11-04', collection: null });
    const after = countDocuments((await exportFirestore(db)).backup);
    expect(after).toEqual(before);
    expect(written).toBe(Object.values(before).reduce((a, b) => a + b, 0));

    // Timestamps come back as timestamps, to the nanosecond, so every document still loads.
    const store = new FirestoreStore(db);
    const job = (await store.jobs.list())[0];
    expect(job?.firstSeenAt).toEqual(new Date('2026-11-04T08:00:00Z'));
    const [app] = await store.applications.list();
    expect(app && (await store.applications.events(app.jobKey))).toHaveLength(2);
  });

  it('restores one collection and leaves the others alone', async () => {
    await seed();
    await backupNow(db, dir, YESTERDAY);
    await clearEmulator();
    await restoreBackup(db, { dir, date: '2026-11-04', collection: 'applications' });
    expect(countDocuments((await exportFirestore(db)).backup)).toEqual({ applications: 3 });
    await expect(
      restoreBackup(db, { dir, date: '2026-11-04', collection: 'weather' }),
    ).rejects.toThrow('the backup from 2026-11-04 has no weather collection');
  });

  it('reads well under the 5,000-document budget, and writes one file per collection', async () => {
    await seed();
    const result = await backupNow(db, dir, YESTERDAY);
    expect(result.reads).toBeLessThan(BACKUP_READ_BUDGET / 5);
    expect(readdirSync(result.folder).sort()).toEqual([
      'applications.json',
      'config.json',
      'jobs.json',
      'kb.json',
      'manifest.json',
      'profile.json',
      'runs.json',
    ]);
    const manifest = JSON.parse(readFileSync(join(result.folder, 'manifest.json'), 'utf8')) as {
      date: string;
      reads: number;
    };
    expect(manifest).toMatchObject({ date: '2026-11-04', reads: result.reads });
    expect(Object.keys(await readBackup(dir, '2026-11-04'))).toContain('jobs');
  });

  it('prunes the folders past their keep date when it writes a new one', async () => {
    await seed();
    await backupNow(db, dir, new Date('2026-09-01T09:00:00Z'));
    await backupNow(db, dir, new Date('2026-09-02T09:00:00Z'));
    const result = await backupNow(db, dir, new Date('2026-11-04T09:00:00Z'));
    expect(result.pruned).toEqual(['2026-09-02']);
    expect(readdirSync(dir).sort()).toEqual(['2026-09-01', '2026-11-04']);
  });
});
