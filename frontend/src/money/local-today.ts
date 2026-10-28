/**
 * The browser's local calendar date as `YYYY-MM-DD`, built from the local year, month and day. Never
 * `toISOString()`: that is UTC, and names a different day than the person's wall clock for part of every day.
 */
export function localToday(now: Date = new Date()): string {
  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
