// Runs `pnpm scout profile …` as a real process against the emulator.
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { clearEmulator, emulatorFirestore, FirestoreStore } from '@scout/adapters';
import { beforeEach, describe, expect, it } from 'vitest';
import { PROFILE_YAML, writeProfileFiles } from './profile/files.fixture';

const run = promisify(execFile);
const cli = fileURLToPath(new URL('./cli.ts', import.meta.url));
const store = new FirestoreStore(emulatorFirestore());

async function scout(...args: string[]) {
  try {
    const { stdout, stderr } = await run('npx', ['tsx', cli, ...args], { env: process.env });
    return { code: 0, out: stdout + stderr };
  } catch (error) {
    const e = error as { code: number; stdout: string; stderr: string };
    return { code: e.code, out: e.stdout + e.stderr };
  }
}

describe('pnpm scout profile', () => {
  beforeEach(clearEmulator);

  it('pushes once, and a second push changes nothing', async () => {
    const files = writeProfileFiles();
    const paths = ['--profile', files.profile, '--answers', files.answers];

    const dry = await scout('profile', 'push', '--dry-run', ...paths);
    expect(dry.code).toBe(0);
    expect(dry.out).toContain('Would change on the emulator');
    expect(dry.out).toContain('+ identity.full_name');
    expect(await store.profile.get()).toBeNull();

    const first = await scout('profile', 'push', ...paths);
    expect(first.out).toContain('Changed on the emulator');
    expect((await store.profile.get())?.identity.full_name).toBe('Alex Example');
    expect(await store.memory.list()).toHaveLength(2);

    const second = await scout('profile', 'push', ...paths);
    expect(second.out).toContain('Nothing to change on the emulator');
  }, 60_000);

  it('exits 1 and writes nothing when the profile still has a required TODO', async () => {
    const files = writeProfileFiles(
      PROFILE_YAML.replace('sip_registered: true', 'sip_registered: TODO'),
    );
    const result = await scout(
      'profile',
      'push',
      '--profile',
      files.profile,
      '--answers',
      files.answers,
    );
    expect(result.code).toBe(1);
    expect(result.out).toContain('Nothing was written. Fix these first:');
    expect(result.out).toContain(
      'profile.yaml: work_authorization.sip_registered: TODO is not allowed',
    );
    expect(await store.profile.get()).toBeNull();
  }, 30_000);

  it('pulls the profile back into profile.yaml', async () => {
    const files = writeProfileFiles();
    const paths = ['--profile', files.profile, '--answers', files.answers];
    await scout('profile', 'push', ...paths);
    const profile = (await store.profile.get())!;
    await store.profile.put({ ...profile, identity: { ...profile.identity, city: 'Calgary, AB' } });
    const pulled = await scout('profile', 'pull', ...paths);
    expect(pulled.out).toContain('~ identity.city');
  }, 60_000);

  it('prints usage for an unknown command', async () => {
    const result = await scout('profile', 'delete');
    expect(result.code).toBe(2);
    expect(result.out).toContain('usage:');
  }, 30_000);
});
