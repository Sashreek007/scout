import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import {
  MemorySeedSchema,
  ProfileFileSchema,
  ProfileSchema,
  describeIssues,
  isTodo,
  normalizeQuestion,
  questionKey,
  type MemorySeed,
  type Profile,
  type ProfileFile,
  type ResumeFile,
} from '@scout/core';
import { parse } from 'yaml';
import { z } from 'zod';

/**
 * Where the seed files are. The defaults are `profile/profile.yaml` and `profile/answers.yaml`,
 * both gitignored; `profile/*.example.yaml` are the templates. A missing answers file means no answers.
 */
export interface ProfilePaths {
  profile: string;
  answers: string;
}

export const DEFAULT_PATHS: ProfilePaths = {
  profile: 'profile/profile.yaml',
  answers: 'profile/answers.yaml',
};

/** The files failed validation. `problems` names every bad path, one per line. */
export class ProfileValidationError extends Error {
  override readonly name = 'ProfileValidationError';
  constructor(readonly problems: string[]) {
    super(`the profile files have ${String(problems.length)} problem(s):\n${problems.join('\n')}`);
  }
}

const RESUME_VARIANTS = ['default', 'backend', 'ai', 'devops'] as const;

export interface SeedFiles {
  profile: Profile;
  memory: (MemorySeed & { questionKey: string })[];
}

/**
 * Reads and checks both files. Every problem in either file is collected before anything is
 * thrown, so one run shows everything left to fix. Nothing here writes.
 */
export async function readSeedFiles(paths: ProfilePaths): Promise<SeedFiles> {
  const problems: string[] = [];
  const profileName = basename(paths.profile);
  const answersName = basename(paths.answers);

  const profileFile = parseWith(
    ProfileFileSchema,
    await readYaml(paths.profile),
    profileName,
    problems,
  );
  const seeds = parseWith(
    z.array(MemorySeedSchema),
    (await readOptionalYaml(paths.answers)) ?? [],
    answersName,
    problems,
  );

  let profile: Profile | null = null;
  if (profileFile) {
    const resumes = await hashResumes(profileFile, dirname(resolve(paths.profile)), problems);
    if (resumes) profile = ProfileSchema.parse({ ...profileFile, resumes });
  }

  const memory: SeedFiles['memory'] = [];
  const firstSeen = new Map<string, number>();
  for (const [i, seed] of (seeds ?? []).entries()) {
    const normalized = normalizeQuestion(seed.question);
    const earlier = firstSeen.get(normalized);
    if (earlier !== undefined) {
      problems.push(`${answersName}: ${String(i)}.question: the same question as entry ${String(earlier)}`);
      continue;
    }
    firstSeen.set(normalized, i);
    memory.push({ ...seed, questionKey: await questionKey(seed.question) });
  }

  if (problems.length > 0 || !profile) throw new ProfileValidationError(problems);
  return { profile, memory };
}

async function readYaml(path: string): Promise<unknown> {
  return parse(await readFile(path, 'utf8')) as unknown;
}

/**
 * Like readYaml, but a file that doesn't exist reads as empty. answers.yaml is gitignored, so a
 * fresh checkout has none, and push never deletes memory, so no file means nothing to add.
 */
async function readOptionalYaml(path: string): Promise<unknown> {
  try {
    return await readYaml(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function parseWith<S extends z.ZodType>(
  schema: S,
  value: unknown,
  file: string,
  problems: string[],
): z.infer<S> | null {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  problems.push(...describeIssues(result.error).map((line) => `${file}: ${line}`));
  return null;
}

/** A resume path: absolute, `~/…`, or relative to the folder profile.yaml is in. */
export function resolveResumePath(path: string, profileDir: string): string {
  if (path === '~' || path.startsWith('~/')) return join(homedir(), path.slice(1));
  return isAbsolute(path) ? path : resolve(profileDir, path);
}

async function hashResumes(
  file: ProfileFile,
  profileDir: string,
  problems: string[],
): Promise<Profile['resumes'] | null> {
  const resumes: Record<string, ResumeFile | 'TODO' | null> = {};
  let ok = true;
  for (const variant of RESUME_VARIANTS) {
    const value = file.resumes[variant];
    if (value === null || isTodo(value)) {
      resumes[variant] = value === null ? null : 'TODO';
      continue;
    }
    const path = resolveResumePath(value, profileDir);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) {
      problems.push(`resumes.${variant}: no file at ${path}`);
      ok = false;
      continue;
    }
    const sha256 = createHash('sha256')
      .update(await readFile(path))
      .digest('hex');
    resumes[variant] = { path, sha256 };
  }
  return ok ? (resumes as Profile['resumes']) : null;
}

/**
 * The leaf paths that differ between two documents: `+` added, `-` removed, `~` changed. Paths
 * only, never values, so the output is safe to print.
 */
export function diffPaths(before: unknown, after: unknown, prefix = ''): string[] {
  const isMap = (v: unknown): v is Record<string, unknown> =>
    v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);
  if (isMap(before) && isMap(after)) {
    const keys = [...new Set([...Object.keys(after), ...Object.keys(before)])];
    return keys.flatMap((key) => {
      const path = prefix === '' ? key : `${prefix}.${key}`;
      if (!(key in before)) return leaves(after[key], path).map((p) => `+ ${p}`);
      if (!(key in after)) return leaves(before[key], path).map((p) => `- ${p}`);
      return diffPaths(before[key], after[key], path);
    });
  }
  if (before === undefined || before === null) {
    if (after === undefined || after === null) return [];
    return leaves(after, prefix).map((p) => `+ ${p}`);
  }
  return JSON.stringify(before) === JSON.stringify(after) ? [] : [`~ ${prefix}`];
}

function leaves(value: unknown, prefix: string): string[] {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, v]) =>
      leaves(v, prefix === '' ? key : `${prefix}.${key}`),
    );
  }
  return [prefix];
}
