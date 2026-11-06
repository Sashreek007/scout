// Security rules tests (#3), against the Firestore emulator. The dashboard reads and writes
// Firestore through these rules; the pipeline and the agent use the Admin SDK, which skips them.
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  DASHBOARD_MOVES,
  STAGES,
  eventId,
  type Application,
  type Stage,
  type StageEvent,
} from '@scout/core';
import { aCreationEvent, aJob, anApplication, aRun } from '@scout/testkit';
import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const rules = readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8');
const OWNER = /return '([^']+)';\s*\/\/ owner uid/.exec(rules)?.[1] ?? '';

let env: RulesTestEnvironment;
let owner: Firestore;
let stranger: Firestore;
let signedOut: Firestore;

beforeAll(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '').split(':');
  env = await initializeTestEnvironment({
    projectId: process.env.GCLOUD_PROJECT ?? 'demo-scout',
    firestore: { rules, host: host ?? '127.0.0.1', port: Number(port) },
  });
  owner = env.authenticatedContext(OWNER).firestore() as unknown as Firestore;
  stranger = env.authenticatedContext('someone-else').firestore() as unknown as Firestore;
  signedOut = env.unauthenticatedContext().firestore() as unknown as Firestore;
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

/** Writes documents as the Admin SDK would, without the rules. */
async function seed(docs: Record<string, object>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    for (const [path, data] of Object.entries(docs)) await setDoc(doc(db, path), data);
  });
}

async function seedApplication(stage: Stage, overrides: Partial<Application> = {}) {
  const app = anApplication({ ...overrides, stage });
  await seed({ [`applications/${app.jobKey}`]: app });
  return app;
}

/** A stage change the way the dashboard writes it: the application and its event in one batch. */
function move(
  db: Firestore,
  app: Application,
  to: Stage,
  overrides: { event?: Partial<StageEvent>; at?: Date; skipEvent?: boolean } = {},
) {
  const at = overrides.at ?? new Date();
  const event: StageEvent = {
    from: app.stage,
    to,
    by: 'you',
    at,
    detail: null,
    ...overrides.event,
  };
  const batch = writeBatch(db);
  batch.update(doc(db, `applications/${app.jobKey}`), { stage: to, stageAt: at });
  if (!overrides.skipEvent) {
    batch.set(doc(db, `applications/${app.jobKey}/events/${eventId(event)}`), event);
  }
  return batch.commit();
}

describe('who can get in', () => {
  it('has the owner user ID as a constant in the rules', () => {
    expect(OWNER).not.toBe('');
  });

  it('lets the owner read', async () => {
    const app = await seedApplication('review');
    await seed({ [`jobs/${app.jobKey}`]: aJob(), 'runs/r1': aRun({ id: 'r1' }) });
    await assertSucceeds(getDoc(doc(owner, `applications/${app.jobKey}`)));
    await assertSucceeds(getDoc(doc(owner, `jobs/${app.jobKey}`)));
    await assertSucceeds(getDoc(doc(owner, 'runs/r1')));
  });

  it('denies another signed-in user every read and write', async () => {
    const app = await seedApplication('review');
    await assertFails(getDoc(doc(stranger, `applications/${app.jobKey}`)));
    await assertFails(updateDoc(doc(stranger, `applications/${app.jobKey}`), { notes: 'hi' }));
    await assertFails(move(stranger, app, 'approved'));
    await assertFails(getDoc(doc(stranger, 'profile/main')));
  });

  it('denies a signed-out user every read and write', async () => {
    const app = await seedApplication('review');
    await assertFails(getDoc(doc(signedOut, `applications/${app.jobKey}`)));
    await assertFails(updateDoc(doc(signedOut, `applications/${app.jobKey}`), { notes: 'hi' }));
    await assertFails(getDoc(doc(signedOut, 'jobs/anything')));
  });
});

describe('what the dashboard may not write', () => {
  it.each(['jobs/greenhouse:northwind:4100001', 'runs/r1', 'counters/2026-11-05'])(
    'denies creating, changing or deleting %s',
    async (path) => {
      await assertFails(setDoc(doc(owner, path), { any: 'thing' }));
      await seed({ [path]: { any: 'thing' } });
      await assertFails(updateDoc(doc(owner, path), { any: 'else' }));
      await assertFails(deleteDoc(doc(owner, path)));
    },
  );

  it.each([
    ['lease', { owner: 'dashboard', expiresAt: new Date() }],
    ['submitAttemptAt', new Date()],
    ['submittedAt', new Date()],
  ] as const)('denies setting %s on an application', async (field, value) => {
    const app = await seedApplication('approved');
    await assertFails(updateDoc(doc(owner, `applications/${app.jobKey}`), { [field]: value }));
  });

  it('denies clearing a lease the agent holds', async () => {
    const app = await seedApplication('filling', {
      lease: { owner: 'mac:4821', expiresAt: new Date('2026-11-05T15:00:00Z') },
    });
    await assertFails(updateDoc(doc(owner, `applications/${app.jobKey}`), { lease: null }));
  });

  it('denies changing the submit markers once the agent set them', async () => {
    const app = await seedApplication('applied', {
      submitAttemptAt: new Date('2026-11-05T15:00:00Z'),
      submittedAt: new Date('2026-11-05T15:00:30Z'),
    });
    const ref = doc(owner, `applications/${app.jobKey}`);
    await assertFails(updateDoc(ref, { submitAttemptAt: null }));
    await assertFails(updateDoc(ref, { submittedAt: new Date() }));
  });

  it('denies creating an application that already has a lease or submit marker', async () => {
    const now = new Date();
    const app = anApplication({
      stageAt: now,
      createdAt: now,
      lease: { owner: 'x', expiresAt: now },
    });
    const batch = writeBatch(owner);
    batch.set(doc(owner, `applications/${app.jobKey}`), app);
    const first = aCreationEvent(app, { by: 'you' });
    batch.set(doc(owner, `applications/${app.jobKey}/events/${eventId(first)}`), first);
    await assertFails(batch.commit());
  });

  it('denies deleting an application', async () => {
    const app = await seedApplication('review');
    await assertFails(deleteDoc(doc(owner, `applications/${app.jobKey}`)));
  });
});

describe('what the dashboard may write', () => {
  it('lets the owner change an application without moving it', async () => {
    const app = await seedApplication('review');
    await assertSucceeds(
      updateDoc(doc(owner, `applications/${app.jobKey}`), { notes: 'Ask about the Go team' }),
    );
  });

  it('lets the owner add a job to the queue with its first event', async () => {
    const now = new Date();
    const app = anApplication({ stageAt: now, createdAt: now });
    const first = aCreationEvent(app, { by: 'you' });
    const batch = writeBatch(owner);
    batch.set(doc(owner, `applications/${app.jobKey}`), app);
    batch.set(doc(owner, `applications/${app.jobKey}/events/${eventId(first)}`), first);
    await assertSucceeds(batch.commit());
  });

  it('denies adding an application without its first event, or past queued', async () => {
    const now = new Date();
    const app = anApplication({ stageAt: now, createdAt: now });
    await assertFails(setDoc(doc(owner, `applications/${app.jobKey}`), app));
    const approved = { ...app, stage: 'approved' as const };
    const event = { ...aCreationEvent(app, { by: 'you' }), to: 'approved' as const };
    const batch = writeBatch(owner);
    batch.set(doc(owner, `applications/${app.jobKey}`), approved);
    batch.set(doc(owner, `applications/${app.jobKey}/events/${eventId(event)}`), event);
    await assertFails(batch.commit());
  });
});

describe('stage moves from the dashboard', () => {
  it('allows exactly the moves a person makes, each with its event, and no others', async () => {
    // The rules must allow exactly the dashboard moves the stage table defines.
    const allowed = new Set(DASHBOARD_MOVES.map(({ from, to }) => `${from}>${to}`));
    const outcomes: string[] = [];
    for (const from of STAGES) {
      for (const to of STAGES) {
        if (from === to) continue;
        await env.clearFirestore();
        const app = await seedApplication(from);
        const result = await move(owner, app, to).then(
          () => 'allowed',
          () => 'denied',
        );
        const expected = allowed.has(`${from}>${to}`) ? 'allowed' : 'denied';
        if (result !== expected) outcomes.push(`${from} to ${to} was ${result}`);
      }
    }
    expect(outcomes).toEqual([]);
  }, 60_000);

  it('denies a stage change that does not write its event', async () => {
    const app = await seedApplication('review');
    await assertFails(move(owner, app, 'approved', { skipEvent: true }));
  });

  it('denies an event that does not match the move', async () => {
    const app = await seedApplication('review');
    await assertFails(move(owner, app, 'approved', { event: { by: 'agent' } }));
    await assertFails(move(owner, app, 'approved', { event: { from: 'needs_answers' } }));
  });

  it('denies one illegal move: review straight to applied', async () => {
    const app = await seedApplication('review');
    await assertFails(move(owner, app, 'applied'));
  });

  it('denies a move stamped far from the time of the request', async () => {
    const app = await seedApplication('review');
    await assertFails(move(owner, app, 'approved', { at: new Date(Date.now() - 3_600_000) }));
  });

  it('denies changing stageAt without a move', async () => {
    const app = await seedApplication('review');
    await assertFails(updateDoc(doc(owner, `applications/${app.jobKey}`), { stageAt: new Date() }));
  });

  it('never lets an event be changed or deleted', async () => {
    const app = await seedApplication('review');
    const event = aCreationEvent(anApplication());
    const path = `applications/${app.jobKey}/events/${eventId(event)}`;
    await seed({ [path]: event });
    await assertFails(updateDoc(doc(owner, path), { detail: 'rewritten' }));
    await assertFails(deleteDoc(doc(owner, path)));
  });
});
