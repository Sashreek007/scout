import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Index {
  collectionGroup: string;
  queryScope: string;
  fields: { fieldPath: string; order: string }[];
}

const config = JSON.parse(
  readFileSync(new URL('./firestore.indexes.json', import.meta.url), 'utf8'),
) as { indexes: Index[]; fieldOverrides: { collectionGroup: string; fieldPath: string }[] };

const paths = (collection: string) =>
  config.indexes
    .filter((index) => index.collectionGroup === collection)
    .map((index) => index.fields.map((field) => field.fieldPath));

describe('firestore.indexes.json', () => {
  it('indexes applications by stage and stageAt, for the Board and Today pages', () => {
    expect(paths('applications')).toContainEqual(['stage', 'stageAt']);
  });

  it('indexes jobs by filter result, triage decision and when they were first seen', () => {
    expect(paths('jobs')).toContainEqual(['filter.passed', 'triage.decision', 'firstSeenAt']);
  });

  it('indexes questions by status and when they were asked', () => {
    expect(paths('questions')).toContainEqual(['status', 'askedAt']);
  });

  it('does not index posting text, which can be 50 KB', () => {
    expect(config.fieldOverrides).toContainEqual(
      expect.objectContaining({ collectionGroup: 'jobs', fieldPath: 'description', indexes: [] }),
    );
  });
});
