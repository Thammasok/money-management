import { describe, expect, it } from 'vitest';
import { localToday } from './local-today';

// Boundary under test: the browser's local calendar date as `YYYY-MM-DD` (never `toISOString()`, which is UTC and would
// name tomorrow in the evening east of Greenwich or yesterday after midnight west of it). Dates are built with the LOCAL
// constructor, so these cases hold in every timezone the suite runs in.

describe('localToday', () => {
  it.each([
    [new Date(2026, 9, 29, 12, 0), '2026-10-29'],
    [new Date(2026, 0, 5, 9, 30), '2026-01-05'],
    [new Date(2024, 1, 29, 0, 0, 1), '2024-02-29'],
    [new Date(2026, 11, 31, 23, 59, 59), '2026-12-31'],
  ])('names the local date of %s: %s', (now, expected) => {
    // Arrange & Act
    const today = localToday(now);

    // Assert
    expect(today).toBe(expected);
  });

  it('uses the current time when none is given', () => {
    // Arrange & Act
    const today = localToday();

    // Assert
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
