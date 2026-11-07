import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { questionKey } from '@scout/core';
import { InMemoryStore } from '@scout/testkit';
import { describe, expect, it } from 'vitest';
import { ANSWERS_YAML, PROFILE_YAML, writeProfileFiles } from './files.fixture';
import { ProfileValidationError, pushProfile } from './push';

const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

describe('pnpm scout profile push', () => {
  it('writes profile/main and one memory document per answer', async () => {
    const files = writeProfileFiles();
    const store = new InMemoryStore();
    await pushProfile(store, files);

    const profile = await store.profile.get();
    expect(profile?.identity.full_name).toBe('Alex Example');
    expect(profile?.availability.relocation).toEqual({
      edmonton: true,
      toronto: 'TODO',
      remote: true,
    });
    const memory = await store.memory.list();
    expect(memory.map((m) => m.question).sort()).toEqual([
      'Are you willing to work in office 3 days a week?',
      'How did you hear about us?',
    ]);
    const key = await questionKey('How did you hear about us?');
    expect(await store.memory.get(key)).toEqual({
      questionKey: key,
      question: 'How did you hear about us?',
      answer: 'Company website',
      kind: 'preference',
      source: 'answers.yaml',
      timesUsed: 0,
      lastUsedAt: null,
    });
  });

  it('stores each resume as its path and SHA-256, and leaves unset ones alone', async () => {
    const files = writeProfileFiles();
    const store = new InMemoryStore();
    await pushProfile(store, files);
    const defaultPdf = join(files.dir, 'resumes/default.pdf');
    expect((await store.profile.get())?.resumes).toEqual({
      default: { path: defaultPdf, sha256: sha256(defaultPdf) },
      backend: {
        path: join(files.dir, 'resumes/backend.pdf'),
        sha256: sha256(join(files.dir, 'resumes/backend.pdf')),
      },
      ai: 'TODO',
      devops: null,
    });
  });

  it('fails a push whose resume file is missing, and writes nothing', async () => {
    const files = writeProfileFiles();
    rmSync(join(files.dir, 'resumes/backend.pdf'));
    const store = new InMemoryStore();
    const error = await pushProfile(store, files).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProfileValidationError);
    expect((error as ProfileValidationError).problems).toEqual([
      `resumes.backend: no file at ${join(files.dir, 'resumes/backend.pdf')}`,
    ]);
    expect(await store.profile.get()).toBeNull();
    expect(await store.memory.list()).toEqual([]);
  });

  it('lists every bad path, including required fields left TODO, and writes nothing', async () => {
    const files = writeProfileFiles(
      PROFILE_YAML.replace('earliest_start: January 2027', 'earliest_start: TODO')
        .replace('sip_registered: true', 'sip_registered: TODO')
        .replace('email: alex@example.com', 'email: not-an-email'),
      ANSWERS_YAML + '- question: "Missing an answer?"\n  source: x\n',
    );
    const store = new InMemoryStore();
    const error = await pushProfile(store, files).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProfileValidationError);
    expect((error as ProfileValidationError).problems).toEqual([
      'profile.yaml: identity.email: Invalid email address',
      'profile.yaml: work_authorization.sip_registered: TODO is not allowed',
      'profile.yaml: availability.earliest_start: TODO is not allowed',
      'answers.yaml: 2.answer: required',
    ]);
    expect(await store.profile.get()).toBeNull();
    expect(await store.memory.list()).toEqual([]);
  });

  it('refuses two answers for the same question', async () => {
    const files = writeProfileFiles(
      PROFILE_YAML,
      ANSWERS_YAML + '- question: "how did you hear about us"\n  answer: A friend\n  source: x\n',
    );
    const error = await pushProfile(new InMemoryStore(), files).catch((e: unknown) => e);
    expect((error as ProfileValidationError).problems).toEqual([
      'answers.yaml: 2.question: the same question as entry 0',
    ]);
  });

  it('reads an answers.yaml that holds only comments as no answers', async () => {
    const files = writeProfileFiles(PROFILE_YAML, '# Grows over time.\n');
    const store = new InMemoryStore();
    await pushProfile(store, files);
    expect(await store.memory.list()).toEqual([]);
  });

  it('reads a missing answers.yaml as no answers and keeps the memory already in Firestore', async () => {
    const files = writeProfileFiles();
    const store = new InMemoryStore();
    await pushProfile(store, files);
    rmSync(files.answers);

    const report = await pushProfile(store, files);
    expect(report.memory).toEqual([]);
    expect(await store.profile.get()).not.toBeNull();
    expect(await store.memory.list()).toHaveLength(2);
  });

  it('reads the shipped answers.example.yaml as no answers, and its example entry is valid', async () => {
    const template = readFileSync(
      new URL('../../../../profile/answers.example.yaml', import.meta.url),
      'utf8',
    );
    const asShipped = writeProfileFiles(PROFILE_YAML, template);
    expect((await pushProfile(new InMemoryStore(), asShipped, { dryRun: true })).memory).toEqual([]);

    const example = template
      .split('\n')
      .filter((line) => /^# (- | {2})\w+:/.test(line))
      .map((line) => line.slice(2))
      .join('\n');
    const uncommented = writeProfileFiles(PROFILE_YAML, example);
    expect((await pushProfile(new InMemoryStore(), uncommented, { dryRun: true })).memory).toEqual([
      '+ Are you willing to work in office 3 days a week?',
    ]);
  });

  it('still fails when answers.yaml exists but cannot be read', async () => {
    const files = writeProfileFiles();
    rmSync(files.answers);
    mkdirSync(files.answers);
    await expect(pushProfile(new InMemoryStore(), files)).rejects.toMatchObject({ code: 'EISDIR' });
  });

  it('still fails when profile.yaml is missing', async () => {
    const files = writeProfileFiles();
    rmSync(files.profile);
    await expect(pushProfile(new InMemoryStore(), files)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('with --dry-run, reports what would change and writes nothing', async () => {
    const files = writeProfileFiles();
    const store = new InMemoryStore();
    const report = await pushProfile(store, files, { dryRun: true });
    expect(report.profile).toContain('+ identity.full_name');
    expect(report.memory).toEqual([
      '+ How did you hear about us?',
      '+ Are you willing to work in office 3 days a week?',
    ]);
    expect(report.wrote).toBe(false);
    expect(await store.profile.get()).toBeNull();
    expect(await store.memory.list()).toEqual([]);

    await pushProfile(store, files);
    const edited = writeProfileFiles(
      PROFILE_YAML.replace('phone: "+1 780 555 0100"', 'phone: "+1 780 555 0199"'),
    );
    const second = await pushProfile(store, edited, { dryRun: true });
    expect(second.profile).toEqual([
      '~ identity.phone',
      '~ resumes.default.path',
      '~ resumes.backend.path',
    ]);
  });

  it('changes nothing when the same files are pushed twice, and keeps use counts', async () => {
    const files = writeProfileFiles();
    const store = new InMemoryStore();
    await pushProfile(store, files);
    const key = await questionKey('How did you hear about us?');
    const used = await store.memory.get(key);
    await store.memory.put({ ...used!, timesUsed: 4, lastUsedAt: new Date('2026-11-04T00:00:00Z') });
    const before = { profile: await store.profile.get(), memory: await store.memory.list() };

    const report = await pushProfile(store, files);
    expect(report).toEqual({ profile: [], memory: [], wrote: false });
    expect({ profile: await store.profile.get(), memory: await store.memory.list() }).toEqual(
      before,
    );
  });

  it('updates an answer he changed in answers.yaml, keeping its use count', async () => {
    const files = writeProfileFiles();
    const store = new InMemoryStore();
    await pushProfile(store, files);
    const key = await questionKey('How did you hear about us?');
    await store.memory.put({ ...(await store.memory.get(key))!, timesUsed: 2 });

    const edited = writeProfileFiles(PROFILE_YAML, ANSWERS_YAML.replace('Company website', 'A friend'));
    const report = await pushProfile(store, edited);
    expect(report.memory).toEqual(['~ How did you hear about us?']);
    expect(await store.memory.get(key)).toMatchObject({ answer: 'A friend', timesUsed: 2 });
  });
});
