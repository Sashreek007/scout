import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { InMemoryStore } from '@scout/testkit';
import { describe, expect, it } from 'vitest';
import { PROFILE_YAML, writeProfileFiles } from './files.fixture';
import { pullProfile } from './pull';
import { pushProfile } from './push';

describe('pnpm scout profile pull', () => {
  it('writes an edit made in Firestore back to profile.yaml, keeping the comments', async () => {
    const files = writeProfileFiles();
    const store = new InMemoryStore();
    await pushProfile(store, files);
    const profile = (await store.profile.get())!;
    await store.profile.put({
      ...profile,
      identity: { ...profile.identity, phone: '+1 780 555 0199' },
      availability: { ...profile.availability, earliest_start: 'May 2027' },
    });

    const result = await pullProfile(store, files);
    expect(result.changed).toEqual(['~ identity.phone', '~ availability.earliest_start']);
    const yaml = readFileSync(files.profile, 'utf8');
    expect(yaml).toContain('phone: "+1 780 555 0199"');
    expect(yaml).toContain('earliest_start: May 2027');
    expect(yaml).toContain('# A test profile. Every value is invented.');
    expect(yaml).toMatch(/us_work_authorized: false +# confirm/);
    expect(yaml).toMatch(/term_lengths_ok: \[4, 8, 12\] +# months/);
    expect(yaml).toContain('edmonton: yes');
  });

  it('leaves profile.yaml untouched when it already matches Firestore', async () => {
    const files = writeProfileFiles();
    const store = new InMemoryStore();
    await pushProfile(store, files);
    expect((await pullProfile(store, files)).changed).toEqual([]);
    expect(readFileSync(files.profile, 'utf8')).toBe(PROFILE_YAML);
  });

  it('round-trips: pushing a pulled file changes nothing', async () => {
    const files = writeProfileFiles();
    const store = new InMemoryStore();
    await pushProfile(store, files);
    const profile = (await store.profile.get())!;
    await store.profile.put({ ...profile, links: { ...profile.links, linkedin: null } });
    await pullProfile(store, files);
    expect(await pushProfile(store, files, { dryRun: true })).toEqual({
      profile: [],
      memory: [],
      wrote: false,
    });
  });

  it('keeps resume paths as he wrote them, and never writes a hash', async () => {
    const files = writeProfileFiles();
    const store = new InMemoryStore();
    await pushProfile(store, files);
    const profile = (await store.profile.get())!;
    await store.profile.put({ ...profile, identity: { ...profile.identity, city: 'Calgary, AB' } });
    await pullProfile(store, files);
    const yaml = readFileSync(files.profile, 'utf8');
    expect(yaml).toMatch(/default: resumes\/default\.pdf +# path to PDF/);
    expect(yaml).not.toMatch(/sha256/);
  });

  it('writes a resume that moved in Firestore as its full path', async () => {
    const files = writeProfileFiles();
    const store = new InMemoryStore();
    await pushProfile(store, files);
    const profile = (await store.profile.get())!;
    const moved = join(files.dir, 'elsewhere.pdf');
    writeFileSync(moved, '%PDF-1.7 moved');
    await store.profile.put({
      ...profile,
      resumes: { ...profile.resumes, ai: { path: moved, sha256: 'a'.repeat(64) } },
    });
    expect((await pullProfile(store, files)).changed).toEqual(['~ resumes.ai']);
    expect(readFileSync(files.profile, 'utf8')).toContain(`ai: ${moved}`);
  });

  it('starts from the template when there is no profile.yaml yet', async () => {
    const files = writeProfileFiles();
    const store = new InMemoryStore();
    await pushProfile(store, files);
    rmSync(files.profile);
    const template = join(files.dir, 'profile.example.yaml');
    writeFileSync(template, `# The template.\n${PROFILE_YAML.replace('Alex Example', 'Your Name')}`);
    await pullProfile(store, { ...files, template });
    const yaml = readFileSync(files.profile, 'utf8');
    expect(yaml).toContain('# The template.');
    expect(yaml).toContain('full_name: Alex Example');
  });

  it('refuses when Firestore has no profile yet', async () => {
    const files = writeProfileFiles();
    await expect(pullProfile(new InMemoryStore(), files)).rejects.toThrow(
      'Firestore has no profile yet. Push one first with pnpm scout profile push.',
    );
    expect(readFileSync(files.profile, 'utf8')).toBe(PROFILE_YAML);
  });
});
