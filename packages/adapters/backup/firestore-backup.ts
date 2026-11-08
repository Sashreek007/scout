// The nightly backup's export and restore (#58). Firestore on the Spark plan has no scheduled
// backups, so scout writes every collection to JSON and can put it back.
import {
  Timestamp,
  type CollectionReference,
  type DocumentData,
  type Firestore,
} from 'firebase-admin/firestore';

/** One document in a backup, with the subcollections under it. */
export interface BackupDoc {
  id: string;
  /** Null for a document that only holds subcollections, like `kb/facts`. */
  data: Record<string, unknown> | null;
  collections?: Record<string, BackupDoc[]>;
}

/** A whole export: each top-level collection, by name. */
export type Backup = Record<string, BackupDoc[]>;

/**
 * Collections whose documents have subcollections: an application's events, items and resume
 * versions, and the knowledge base's items. Only these are looked into, so the export doesn't
 * list the subcollections of 650 jobs that have none.
 */
const NESTED = new Set(['applications', 'kb']);

/** A Firestore value as JSON. Timestamps keep their nanoseconds; everything else is plain. */
function encode(value: unknown): unknown {
  if (value instanceof Timestamp) {
    return { __timestamp: { seconds: value.seconds, nanoseconds: value.nanoseconds } };
  }
  if (Array.isArray(value)) return value.map(encode);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
  }
  return value;
}

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value !== null && typeof value === 'object') {
    const stamp = (value as { __timestamp?: { seconds: number; nanoseconds: number } }).__timestamp;
    if (stamp) return new Timestamp(stamp.seconds, stamp.nanoseconds);
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decode(v)]));
  }
  return value;
}

export interface ExportResult {
  backup: Backup;
  /** Documents read, which Firestore bills as reads. */
  reads: number;
}

async function exportCollection(
  ref: CollectionReference,
  nested: boolean,
  count: { reads: number },
): Promise<BackupDoc[]> {
  const snap = await ref.get();
  count.reads += snap.size;
  const docs = new Map<string, BackupDoc>(
    snap.docs.map((doc) => [doc.id, { id: doc.id, data: encode(doc.data()) as DocumentData }]),
  );
  if (nested) {
    for (const doc of await ref.listDocuments()) {
      const subs = await doc.listCollections();
      if (subs.length === 0) continue;
      const entry = docs.get(doc.id) ?? { id: doc.id, data: null };
      entry.collections = {};
      for (const sub of subs.sort((a, b) => (a.id < b.id ? -1 : 1))) {
        entry.collections[sub.id] = await exportCollection(sub, true, count);
      }
      docs.set(doc.id, entry);
    }
  }
  return [...docs.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Exports every top-level collection, or just the ones named, with their subcollections. */
export async function exportFirestore(
  db: Firestore,
  only?: readonly string[],
): Promise<ExportResult> {
  const count = { reads: 0 };
  const backup: Backup = {};
  const collections = (await db.listCollections()).sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const ref of collections) {
    if (only && !only.includes(ref.id)) continue;
    backup[ref.id] = await exportCollection(ref, NESTED.has(ref.id), count);
  }
  return { backup, reads: count.reads };
}

async function restoreDocs(ref: CollectionReference, docs: readonly BackupDoc[]): Promise<number> {
  let written = 0;
  for (let i = 0; i < docs.length; i += 500) {
    const batch = ref.firestore.batch();
    for (const doc of docs.slice(i, i + 500)) {
      if (doc.data !== null) {
        batch.set(ref.doc(doc.id), decode(doc.data) as DocumentData);
        written += 1;
      }
    }
    await batch.commit();
  }
  for (const doc of docs) {
    for (const [name, sub] of Object.entries(doc.collections ?? {})) {
      written += await restoreDocs(ref.doc(doc.id).collection(name), sub);
    }
  }
  return written;
}

/**
 * Writes the named collections from a backup back into Firestore, with their subcollections, and
 * says how many documents it wrote. Documents that exist now but aren't in the backup are left
 * as they are, so a restore never deletes anything.
 */
export async function restoreFirestore(
  db: Firestore,
  backup: Backup,
  collections: readonly string[],
): Promise<number> {
  let written = 0;
  for (const name of collections) {
    const docs = backup[name];
    if (!docs) throw new Error(`the backup has no ${name} collection`);
    written += await restoreDocs(db.collection(name), docs);
  }
  return written;
}

/** How many documents a backup holds, per top-level collection, counting subcollections in. */
export function countDocuments(backup: Backup): Record<string, number> {
  const count = (docs: readonly BackupDoc[]): number =>
    docs.reduce(
      (sum, doc) =>
        sum +
        (doc.data === null ? 0 : 1) +
        Object.values(doc.collections ?? {}).reduce((s, sub) => s + count(sub), 0),
      0,
    );
  return Object.fromEntries(Object.entries(backup).map(([name, docs]) => [name, count(docs)]));
}
