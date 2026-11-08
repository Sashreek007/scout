import { describe, expect, it } from 'vitest';
import { backupFolder, foldersToPrune } from './backups';

describe('backupFolder', () => {
  it('names a day in UTC', () => {
    expect(backupFolder(new Date('2026-11-04T09:00:00Z'))).toBe('2026-11-04');
    expect(backupFolder(new Date('2026-11-04T23:59:59Z'))).toBe('2026-11-04');
  });
});

describe('foldersToPrune', () => {
  const today = new Date('2026-11-07T09:00:00Z');

  it('keeps every day for 30 days', () => {
    expect(foldersToPrune(['2026-11-06', '2026-10-08', '2026-10-09'], today)).toEqual([]);
  });

  it('deletes daily backups older than 30 days', () => {
    expect(foldersToPrune(['2026-10-07', '2026-10-06', '2026-09-15'], today)).toEqual([
      '2026-09-15',
      '2026-10-06',
      '2026-10-07',
    ]);
  });

  it('keeps the first of each month for a year, then deletes it', () => {
    expect(
      foldersToPrune(['2026-10-01', '2026-03-01', '2025-12-01', '2025-11-08', '2025-10-01'], today),
    ).toEqual(['2025-10-01', '2025-11-08']);
  });

  it('never touches anything that is not a dated folder', () => {
    expect(foldersToPrune(['README.md', '.git', 'notes', '2026-1-01'], today)).toEqual([]);
  });

  it('keeps 30 daily and 12 monthly folders when run every day for two years', () => {
    let folders: string[] = [];
    const start = Date.UTC(2025, 0, 1);
    for (let day = 0; day < 730; day += 1) {
      const date = new Date(start + day * 24 * 60 * 60 * 1000);
      folders.push(backupFolder(date));
      const pruned = new Set(foldersToPrune(folders, date));
      folders = folders.filter((name) => !pruned.has(name));
    }
    const firsts = folders.filter((name) => name.endsWith('-01'));
    expect(folders.length).toBeLessThanOrEqual(31 + 13);
    expect(folders.length - firsts.length).toBeLessThanOrEqual(31);
    expect(firsts.length).toBeLessThanOrEqual(13);
  });
});
