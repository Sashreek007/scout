// `pnpm scout profile pull`: writes the profile in Firestore back to profile.yaml, so edits made in
// the dashboard can be kept locally (#4). Only values that differ are changed, so his comments
// survive, though the YAML library may re-space them. A file that already matches isn't touched.
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { ProfileFileSchema, type ProfileFile, type Store } from '@scout/core';
import { isMap, isScalar, isSeq, parse, parseDocument, type Document } from 'yaml';
import { diffPaths, resolveResumePath, type ProfilePaths } from './files';

export interface PullPaths extends ProfilePaths {
  /** Used as the starting point when profile.yaml doesn't exist yet. */
  template?: string;
}

export async function pullProfile(
  store: Store,
  paths: PullPaths,
): Promise<{ changed: string[] }> {
  const stored = await store.profile.get();
  if (!stored) {
    throw new Error('Firestore has no profile yet. Push one first with pnpm scout profile push.');
  }
  const source = existsSync(paths.profile)
    ? paths.profile
    : (paths.template ?? 'profile/profile.example.yaml');
  const text = await readFile(source, 'utf8');

  // Keep a resume path as he wrote it, relative or with ~, while it still points at the same file.
  const written = (parse(text) as { resumes?: Record<string, unknown> } | null)?.resumes ?? {};
  const profileDir = dirname(resolve(paths.profile));
  const file: ProfileFile = ProfileFileSchema.parse({
    ...stored,
    resumes: Object.fromEntries(
      Object.entries(stored.resumes).map(([variant, resume]) => {
        if (resume === null || typeof resume !== 'object') return [variant, resume];
        const raw = written[variant];
        const same = typeof raw === 'string' && resolveResumePath(raw, profileDir) === resume.path;
        return [variant, same ? raw : resume.path];
      }),
    ),
  });

  const doc = parseDocument(text);
  const before = await currentFile(paths).catch(() => null);
  const changed = diffPaths(before, file);
  if (changed.length === 0 && source === paths.profile) return { changed };
  apply(doc, file, []);
  await writeFile(paths.profile, doc.toString({ nullStr: '', flowCollectionPadding: false }));
  return { changed };
}

/** What profile.yaml held before the pull, for the report, with resume paths as written. */
async function currentFile(paths: ProfilePaths): Promise<ProfileFile> {
  return ProfileFileSchema.parse(parse(await readFile(paths.profile, 'utf8')));
}

type Path = (string | number)[];

/** Sets each leaf that differs, in place, so unchanged lines keep their comments and style. */
function apply(doc: Document, value: unknown, path: Path): void {
  const node = path.length === 0 ? doc.contents : doc.getIn(path, true);
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    if (!isMap(node)) {
      doc.setIn(path, doc.createNode(value));
      return;
    }
    for (const pair of [...node.items]) {
      const key = isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
      if (!(key in value)) node.delete(pair.key);
    }
    for (const [key, child] of Object.entries(value)) apply(doc, child, [...path, key]);
    return;
  }
  if (Array.isArray(value)) {
    if (isSeq(node) && JSON.stringify(node.toJSON()) === JSON.stringify(value)) return;
    const seq = doc.createNode(value);
    if (isSeq(node)) seq.flow = node.flow;
    doc.setIn(path, seq);
    return;
  }
  if (isScalar(node)) {
    if (sameScalar(node.value, value)) return;
    node.value = value;
    return;
  }
  doc.setIn(path, value);
}

/** YAML 1.2 keeps `yes` and `no` as strings; the profile reads them as booleans. */
function sameScalar(existing: unknown, value: unknown): boolean {
  if (existing === value) return true;
  if (typeof value === 'boolean') return existing === (value ? 'yes' : 'no');
  return existing === null && value === undefined;
}
