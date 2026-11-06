import { ApplicationSchema, ProfileSchema } from '@scout/core';
import { devSeed } from '@scout/testkit';
import { Timestamp } from 'firebase-admin/firestore';
import { beforeEach, describe, expect, it } from 'vitest';
import { emulatorFirestore, seedEmulator } from './seed-emulator';

const db = emulatorFirestore();

async function clearEmulator() {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? '';
  const project = process.env.GCLOUD_PROJECT ?? '';
  const res = await fetch(
    `http://${host}/emulator/v1/projects/${project}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  expect(res.ok).toBe(true);
}

/** Firestore hands back Timestamps; the schemas expect Dates. */
function withDates(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate();
  if (Array.isArray(value)) return value.map(withDates);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withDates(v)]));
  }
  return value;
}

describe('seeding the emulator for pnpm dev', () => {
  beforeEach(clearEmulator);

  it('writes every seeded document, and seeding twice adds nothing', async () => {
    const seed = devSeed();
    await seedEmulator(db);
    await seedEmulator(db);
    expect((await db.collection('jobs').get()).size).toBe(seed.jobs.length);
    expect((await db.collection('applications').get()).size).toBe(seed.applications.length);
    const first = seed.applications[0]!;
    const events = await db.collection(`applications/${first.app.jobKey}/events`).get();
    expect(events.size).toBe(first.events.length);
  });

  it('stores documents the schemas still accept when read back', async () => {
    await seedEmulator(db);
    const profile = await db.doc('profile/main').get();
    expect(ProfileSchema.parse(withDates(profile.data()))).toEqual(devSeed().profile);
    const app = await db.doc('applications/greenhouse:northwind:4100001').get();
    expect(ApplicationSchema.parse(withDates(app.data())).stage).toBe('needs_answers');
  });
});
