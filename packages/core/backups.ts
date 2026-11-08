// Which nightly backups to keep (#58, docs/architecture.md, section 6, "Backups"): every day for 30
// days, and the first of each month for a year. Folders are named by the day, like `2026-11-04`.

const FOLDER = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Daily backups are kept this many days. */
export const DAILY_KEEP_DAYS = 30;
/** The first of each month is kept this many days. */
export const MONTHLY_KEEP_DAYS = 365;

/** The folder for a day's backup, in UTC: `2026-11-04`. */
export function backupFolder(day: Date): string {
  return day.toISOString().slice(0, 10);
}

/**
 * The backup folders to delete on `today`: daily ones older than 30 days, unless they are the first
 * of a month, and those older than a year. Anything that isn't a dated folder is never touched.
 */
export function foldersToPrune(folders: readonly string[], today: Date): string[] {
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return folders
    .filter((name) => {
      const match = FOLDER.exec(name);
      if (!match) return false;
      const [, year, month, day] = match;
      const at = Date.UTC(Number(year), Number(month) - 1, Number(day));
      const age = (now - at) / DAY_MS;
      if (age <= DAILY_KEEP_DAYS) return false;
      return day !== '01' || age > MONTHLY_KEEP_DAYS;
    })
    .sort();
}
